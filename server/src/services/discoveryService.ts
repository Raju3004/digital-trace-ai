import type { Clue, DataMode, NormalizedRecord, SourceAttempt } from '../types/index.js';
import { cluesToCrawlInput } from './clueService.js';
import { crawlUsernames } from '../crawlers/usernameCrawler.js';
import { crawlGitHub } from '../crawlers/githubCrawler.js';
import { crawlCompany } from '../crawlers/companyCrawler.js';
import { crawlEvents } from '../crawlers/eventCrawler.js';
import { crawlPublications } from '../crawlers/publicationCrawler.js';
import { crawlWebsite } from '../crawlers/websiteCrawler.js';
import { discoverViaSearch, rankHits } from '../crawlers/searchCrawler.js';
import { buildMockRecords } from '../data/mockRecords.js';
import { ALLOWED_DOMAINS } from '../config/allowlist.js';
import { allowDiscoveredHost, resetCrawlSession } from '../crawlers/httpClient.js';
import { enabledSites } from '../config/sites.js';
import { nowIso } from '../utils/ids.js';
import { uniq } from '../utils/text.js';

export interface DiscoveryResult {
  records: NormalizedRecord[];
  attempts: SourceAttempt[];
}

type Progress = (
  stage: string,
  message: string,
  level?: 'info' | 'warn' | 'success' | 'error',
) => void;

export interface DiscoveryOptions {
  mode: DataMode;
  onProgress?: Progress;
}

/**
 * PUBLIC SOURCE DISCOVERY
 *
 * Public Source Mode runs six stages in order, each feeding the next:
 *   1. username enumeration across the registered profile sites
 *   2. GitHub public REST / profile enrichment
 *   3. search-engine lead generation
 *   4. retrieval of the most promising leads (personal sites, org pages)
 *   5. organization and event pages from the allowlist
 *   6. publication indexes
 *
 * Demo Data Mode returns the local fixture instead, clearly labelled, and runs
 * it through the identical downstream services.
 */
export async function discoverPublicSources(
  clues: Clue[],
  options: DiscoveryOptions,
): Promise<DiscoveryResult> {
  const input = cluesToCrawlInput(clues);
  const progress = options.onProgress ?? (() => {});

  if (options.mode === 'demo') {
    progress(
      'discovery',
      'Demo Data Mode — loading the built-in synthetic subject. The context you typed is NOT searched in this mode.',
      'warn',
    );
    const records = buildMockRecords();
    const attempts: SourceAttempt[] = uniq(records.map((r) => r.url)).map((url) => {
      const rec = records.find((r) => r.url === url)!;
      return { url, source: rec.source, ok: true, elapsedMs: 0, at: nowIso() };
    });
    progress('discovery', `${records.length} demo records loaded from the local fixture.`, 'success');
    return { records, attempts };
  }

  resetCrawlSession();
  const records: NormalizedRecord[] = [];
  const attempts: SourceAttempt[] = [];

  if (!input.names.length && !input.usernames.length) {
    progress(
      'discovery',
      'No name or username supplied. Public Source Mode needs at least one of these to generate search clues.',
      'error',
    );
    return { records, attempts };
  }

  // ---- 1. Username enumeration ------------------------------------------
  const siteCount = enabledSites().length;
  progress(
    'discovery',
    `Testing candidate handles against ${siteCount} public profile sites…`,
    'info',
  );

  const usernameCrawl = await crawlUsernames(input, {
    maxHandles: 4,
    onHit: (site, url) => progress('discovery', `Public profile found — ${site}: ${url}`, 'success'),
  });
  records.push(...usernameCrawl.records);
  attempts.push(...usernameCrawl.attempts);
  progress(
    'discovery',
    `Handle enumeration: ${usernameCrawl.records.length} public profile(s) confirmed from ${usernameCrawl.attempts.length} request(s).`,
    usernameCrawl.records.length ? 'success' : 'warn',
  );

  // ---- 2. GitHub enrichment ---------------------------------------------
  const githubHandles = uniq(
    usernameCrawl.records
      .filter((r) => r.source === 'GitHub')
      .flatMap((r) => r.usernames)
      .concat(input.usernames),
  );
  if (githubHandles.length) {
    progress('discovery', 'Enriching GitHub profile with public repository data…', 'info');
    const gh = await crawlGitHub({ ...input, usernames: githubHandles }, 2);
    records.push(...gh.records);
    attempts.push(...gh.attempts);
    if (gh.records.length) {
      progress('discovery', `GitHub: ${gh.records.length} additional record(s).`, 'success');
    }
  }

  // ---- 3. Search-engine leads -------------------------------------------
  progress('discovery', 'Generating search leads from the supplied context…', 'info');
  const search = await discoverViaSearch(input);
  attempts.push(...search.result.attempts);

  const ranked = rankHits(search.hits, input);
  if (ranked.length) {
    progress('discovery', `${ranked.length} search lead(s) found; retrieving the strongest.`, 'success');
  } else {
    progress(
      'discovery',
      'No search leads returned. Discovery continues with the profiles already confirmed.',
      'warn',
    );
  }

  // ---- 4. Retrieve the best leads ---------------------------------------
  const profileLinks = uniq(records.flatMap((r) => r.links)).filter(isFollowable);
  const leadUrls = uniq([...profileLinks, ...ranked.slice(0, 8).map((h) => h.url)]).slice(0, 10);

  for (const lead of leadUrls) {
    try {
      allowDiscoveredHost(new URL(lead).hostname);
    } catch {
      /* skip malformed */
    }
  }

  if (leadUrls.length) {
    progress('discovery', `Retrieving ${leadUrls.length} linked / discovered page(s)…`, 'info');
    const site = await crawlWebsite(leadUrls, 10);
    records.push(...site.records);
    attempts.push(...site.attempts);
    progress(
      'discovery',
      `Linked pages: ${site.records.length} record(s) retrieved.`,
      site.records.length ? 'success' : 'warn',
    );
  }

  // ---- 5. Organization + event pages from the allowlist ------------------
  const orgDomains = allowlistedDomainsFor('official_organization');
  if (orgDomains.length && input.organizations.length) {
    progress('discovery', 'Retrieving permitted organization pages…', 'info');
    const co = await crawlCompany(input, orgDomains);
    records.push(...co.records);
    attempts.push(...co.attempts);
  }

  const eventBases = allowlistedDomainsFor('event_listing').map((d) => `https://${d}`);
  if (eventBases.length && input.events.length) {
    progress('discovery', 'Retrieving permitted event listings…', 'info');
    const ev = await crawlEvents(input, eventBases);
    records.push(...ev.records);
    attempts.push(...ev.attempts);
  }

  // ---- 6. Publications ---------------------------------------------------
  if (input.names.length) {
    progress('discovery', 'Querying the public publication index…', 'info');
    const pub = await crawlPublications(input);
    records.push(...pub.records);
    attempts.push(...pub.attempts);
    if (pub.records.length) {
      progress('discovery', `Publications: ${pub.records.length} record(s).`, 'success');
    }
  }

  const merged = mergeDuplicateRecords(records);
  if (merged.length !== records.length) {
    progress(
      'discovery',
      `Merged ${records.length - merged.length} duplicate record(s) retrieved by more than one crawler.`,
      'info',
    );
  }
  records.length = 0;
  records.push(...merged);

  const retrieved = attempts.filter((a) => a.ok).length;
  const refused = attempts.filter((a) => !a.ok && a.blockedBy === 'http').length;
  const notFound = attempts.length - retrieved - refused;

  progress(
    'discovery',
    `Discovery finished: ${records.length} record(s) from ${retrieved} retrieved page(s). ` +
      `${refused} source(s) refused automated access, ${notFound} had no public page for these clues.`,
    records.length ? 'success' : 'warn',
  );

  return { records, attempts };
}

/**
 * Several crawlers can legitimately reach the same URL — the username
 * enumerator and the GitHub enricher both land on a GitHub profile, for
 * instance. Keep one record per URL and union what each of them learned,
 * so nothing discovered is lost and nothing is double-counted as corroboration.
 */
function mergeDuplicateRecords(records: NormalizedRecord[]): NormalizedRecord[] {
  const byUrl = new Map<string, NormalizedRecord>();

  const key = (url: string) => {
    try {
      const u = new URL(url);
      return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch {
      return url.toLowerCase();
    }
  };

  for (const rec of records) {
    const k = key(rec.url);
    const existing = byUrl.get(k);
    if (!existing) {
      byUrl.set(k, { ...rec });
      continue;
    }

    existing.person ??= rec.person;
    existing.bio = existing.bio || rec.bio;
    existing.avatarUrl = existing.avatarUrl || rec.avatarUrl;
    existing.avatarHash = existing.avatarHash || rec.avatarHash;
    existing.usernames = uniq([...existing.usernames, ...rec.usernames]);
    existing.organizations = uniq([...existing.organizations, ...rec.organizations]);
    existing.roles = uniq([...existing.roles, ...rec.roles]);
    existing.projects = uniq([...existing.projects, ...rec.projects]);
    existing.events = uniq([...existing.events, ...rec.events]);
    existing.publications = uniq([...existing.publications, ...rec.publications]);
    existing.locations = uniq([...existing.locations, ...rec.locations]);
    existing.dates = uniq([...existing.dates, ...rec.dates]);
    existing.links = uniq([...existing.links, ...rec.links]);

    const seenEvidence = new Set(existing.rawEvidence.map((e) => `${e.label}|${e.excerpt}`));
    for (const ev of rec.rawEvidence) {
      const id = `${ev.label}|${ev.excerpt}`;
      if (!seenEvidence.has(id)) {
        seenEvidence.add(id);
        existing.rawEvidence.push(ev);
      }
    }
  }

  return [...byUrl.values()];
}

function isFollowable(link: string): boolean {
  try {
    const host = new URL(link).hostname;
    // Profile hosts are already covered by the enumeration step.
    return !/(github|gitlab|arxiv|duckduckgo)\.(com|org)$/.test(host);
  } catch {
    return false;
  }
}

function allowlistedDomainsFor(type: string): string[] {
  return ALLOWED_DOMAINS.filter((d) => d.enabled && d.sourceType === type).map((d) => d.domain);
}

export function sourceStatus() {
  return ALLOWED_DOMAINS.map((d) => ({
    domain: d.domain,
    label: d.label,
    sourceType: d.sourceType,
    reliability: d.reliability,
    basis: d.basis,
    enabled: d.enabled,
  }));
}
