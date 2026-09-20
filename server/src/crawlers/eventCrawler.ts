import { fetchPublicPage } from './httpClient.js';
import { parseEvent } from '../parsers/eventParser.js';
import { attemptFrom, buildRecord, emptyResult, type CrawlInput, type CrawlResult } from './base.js';
import { nameSimilarity } from '../utils/text.js';

const EVENT_PATHS = ['', '/participants', '/teams', '/speakers', '/projects', '/schedule'];

/** Event / hackathon public listing crawler (allowlisted domains only). */
export async function crawlEvents(
  input: CrawlInput,
  eventUrls: string[],
  maxPages = 6,
): Promise<CrawlResult> {
  const result = emptyResult();
  const targetName = input.names[0];
  let fetched = 0;

  for (const base of eventUrls) {
    for (const path of EVENT_PATHS) {
      if (fetched >= maxPages) return result;
      const url = `${base.replace(/\/$/, '')}${path}`;
      const outcome = await fetchPublicPage(url);
      result.attempts.push(attemptFrom('Event Website', outcome));
      if (!outcome.ok || !outcome.html) continue;
      fetched += 1;

      const parsed = parseEvent(outcome.html, targetName);
      const hit = parsed.participants.find(
        (p) => p.person && (!targetName || nameSimilarity(p.person, targetName) >= 0.7),
      );
      if (!hit) continue;

      result.records.push(
        buildRecord({
          source: parsed.eventName ?? 'Public event listing',
          sourceType: 'event_listing',
          url,
          title: `${parsed.eventName ?? 'Event'} — ${hit.role ?? 'listing'}`,
          person: hit.person,
          organizations: hit.organization ? [hit.organization] : [],
          roles: hit.role ? [hit.role] : [],
          projects: hit.project ? [hit.project] : [],
          events: parsed.eventName ? [parsed.eventName] : [],
          dates: parsed.dates,
          rawEvidence: parsed.evidence,
          provenance: 'PUBLIC_SOURCE',
          reliability: 'Medium-High',
        }),
      );
    }
  }

  return result;
}
