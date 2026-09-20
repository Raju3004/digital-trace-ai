import * as cheerio from 'cheerio';
import { fetchPublicPage, normalizeUrl } from './httpClient.js';
import { parseProfile } from '../parsers/profileParser.js';
import { parseProjects, projectNames } from '../parsers/projectParser.js';
import { attemptFrom, buildRecord, emptyResult, type CrawlResult } from './base.js';
import { CRAWLER_CONFIG } from '../config/allowlist.js';
import { uniq } from '../utils/text.js';

/**
 * Personal / generic website crawler with bounded depth.
 *
 * Follows only same-host links, never exceeds `maxCrawlDepth`, and relies on
 * `fetchPublicPage` for allowlist + robots enforcement and duplicate detection.
 */
export async function crawlWebsite(
  seedUrls: string[],
  maxPages = 6,
  maxDepth = CRAWLER_CONFIG.maxCrawlDepth,
): Promise<CrawlResult> {
  const result = emptyResult();
  const queue: { url: string; depth: number }[] = seedUrls.map((u) => ({ url: u, depth: 0 }));
  let fetched = 0;

  while (queue.length && fetched < maxPages) {
    const { url, depth } = queue.shift()!;
    const outcome = await fetchPublicPage(url);
    result.attempts.push(attemptFrom('Personal / Public Website', outcome));
    if (!outcome.ok || !outcome.html) continue;
    fetched += 1;

    const profile = parseProfile(outcome.html, url);
    const projects = parseProjects(outcome.html, url);
    const $ = cheerio.load(outcome.html);
    const title = $('title').first().text().trim() || url;

    result.records.push(
      buildRecord({
        source: new URL(url).hostname,
        sourceType: 'personal_website',
        url,
        title,
        person: profile.person,
        usernames: profile.username ? [profile.username] : [],
        organizations: profile.organizations,
        projects: projectNames(projects),
        locations: profile.locations,
        links: profile.links,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        rawEvidence: [...profile.evidence, ...projects.evidence],
        provenance: 'PUBLIC_SOURCE',
        reliability: 'Medium',
      }),
    );

    if (depth < maxDepth) {
      const host = new URL(url).hostname;
      const next = uniq(
        $('a[href]')
          .map((_, a) => $(a).attr('href') ?? '')
          .get()
          .map((href) => {
            try {
              return normalizeUrl(new URL(href, url).toString());
            } catch {
              return '';
            }
          })
          .filter((h) => {
            if (!h) return false;
            try {
              return new URL(h).hostname === host;
            } catch {
              return false;
            }
          }),
      ).slice(0, 8);
      for (const n of next) queue.push({ url: n, depth: depth + 1 });
    }
  }

  return result;
}
