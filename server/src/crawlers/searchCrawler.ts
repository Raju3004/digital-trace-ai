import * as cheerio from 'cheerio';
import { fetchPublicPage } from './httpClient.js';
import { attemptFrom, emptyResult, type CrawlInput, type CrawlResult } from './base.js';
import { isHostDenied } from '../config/allowlist.js';
import { normalize, uniq } from '../utils/text.js';

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  query: string;
}

/**
 * SEARCH DISCOVERY
 *
 * Uses DuckDuckGo's public no-JavaScript endpoint to turn the supplied context
 * into candidate URLs. Search results are treated as LEADS, never as findings:
 * nothing from here becomes a record until the page itself has been retrieved
 * and parsed, and the source is classified Low-Medium reliability.
 */
export async function discoverViaSearch(
  input: CrawlInput,
  maxQueries = 4,
): Promise<{ hits: SearchHit[]; result: CrawlResult }> {
  const result = emptyResult();
  const hits: SearchHit[] = [];

  const queries = buildQueries(input).slice(0, maxQueries);

  for (const query of queries) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const outcome = await fetchPublicPage(url);
    result.attempts.push(attemptFrom('DuckDuckGo', outcome));
    if (!outcome.ok || !outcome.html) continue;

    const $ = cheerio.load(outcome.html);
    $('.result, .web-result').each((_, el) => {
      const node = $(el);
      const anchor = node.find('a.result__a').first();
      const title = anchor.text().trim();
      const href = anchor.attr('href');
      const snippet = node.find('.result__snippet').first().text().replace(/\s+/g, ' ').trim();
      if (!title || !href) return;

      const resolved = resolveDuckDuckGoLink(href);
      if (!resolved) return;

      try {
        if (isHostDenied(new URL(resolved).hostname)) return;
      } catch {
        return;
      }

      hits.push({ title, url: resolved, snippet, query });
    });
  }

  // De-duplicate by URL, keeping the first (highest-ranked) occurrence.
  const seen = new Set<string>();
  const deduped = hits.filter((h) => {
    const key = h.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { hits: deduped, result };
}

function buildQueries(input: CrawlInput): string[] {
  const name = input.names[0];
  const handle = input.usernames[0];
  const org = input.organizations[0];
  const event = input.events[0];
  const location = input.locations[0];
  const keyword = input.keywords[0];

  const queries: string[] = [];

  if (name && org) queries.push(`"${name}" "${org}"`);
  if (name && event) queries.push(`"${name}" "${event}"`);
  if (handle) queries.push(`"${handle}"`);
  if (name && location) queries.push(`"${name}" ${location}`);
  if (name && keyword) queries.push(`"${name}" ${keyword}`);
  if (name && !org && !event && !location) queries.push(`"${name}"`);

  return uniq(queries);
}

/** DuckDuckGo wraps outbound links in /l/?uddg=<encoded>. */
function resolveDuckDuckGoLink(href: string): string | null {
  try {
    const absolute = href.startsWith('http')
      ? href
      : `https://duckduckgo.com${href.startsWith('//') ? href.slice(1) : href}`;
    const u = new URL(absolute);
    const target = u.searchParams.get('uddg');
    const final = target ? decodeURIComponent(target) : absolute;
    if (!final.startsWith('http')) return null;
    if (new URL(final).hostname.endsWith('duckduckgo.com')) return null;
    return final;
  } catch {
    return null;
  }
}

/**
 * Ranks search leads by how well they align with the supplied context, so the
 * crawler spends its page budget on the most promising pages first.
 */
export function rankHits(hits: SearchHit[], input: CrawlInput): SearchHit[] {
  const needles = [
    ...input.names,
    ...input.usernames,
    ...input.organizations,
    ...input.events,
    ...input.keywords,
  ]
    .map(normalize)
    .filter(Boolean);

  const score = (h: SearchHit) => {
    const hay = normalize(`${h.title} ${h.snippet} ${h.url}`);
    let s = 0;
    for (const n of needles) if (n && hay.includes(n)) s += 1;
    // Personal sites and org pages are worth more than aggregator noise.
    if (/\.(dev|me|io|com)\/?$/.test(h.url)) s += 0.5;
    if (/(about|team|people|profile|portfolio)/.test(hay)) s += 0.5;
    return s;
  };

  return [...hits].sort((a, b) => score(b) - score(a));
}
