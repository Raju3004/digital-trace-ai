import { fetchPublicPage } from './httpClient.js';
import { parseOrganization } from '../parsers/organizationParser.js';
import { attemptFrom, buildRecord, emptyResult, type CrawlInput, type CrawlResult } from './base.js';
import { nameSimilarity } from '../utils/text.js';

/** Public pages typically carrying team / people information. */
const CANDIDATE_PATHS = ['/team', '/about', '/people', '/leadership', '/company', '/projects'];

/**
 * Company / organization website crawler.
 *
 * Only runs against organizer-approved domains that are on the allowlist —
 * `fetchPublicPage` refuses anything else before a request is made.
 */
export async function crawlCompany(
  input: CrawlInput,
  domains: string[],
  maxPages = 6,
): Promise<CrawlResult> {
  const result = emptyResult();
  const targetName = input.names[0];
  let fetched = 0;

  for (const domain of domains) {
    for (const path of CANDIDATE_PATHS) {
      if (fetched >= maxPages) return result;
      const url = `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}${path}`;
      const outcome = await fetchPublicPage(url);
      result.attempts.push(attemptFrom('Company Website', outcome));
      if (!outcome.ok || !outcome.html) continue;
      fetched += 1;

      const org = parseOrganization(outcome.html, url, targetName);
      const match = org.members.find(
        (m) => !targetName || nameSimilarity(m.name, targetName) >= 0.7,
      );
      if (!match && !org.members.length) continue;

      const member = match ?? org.members[0];
      result.records.push(
        buildRecord({
          source: org.organization ?? domain,
          sourceType: 'official_organization',
          url,
          title: `${org.organization ?? domain} — ${path.replace('/', '')} page`,
          person: member?.name ?? null,
          organizations: org.organization ? [org.organization] : [domain],
          roles: member?.role ? [member.role] : [],
          projects: org.projects,
          locations: member?.location ? [member.location] : [],
          links: member?.links ?? [],
          bio: member?.bio ?? null,
          rawEvidence: org.evidence,
          provenance: 'PUBLIC_SOURCE',
          reliability: 'High',
        }),
      );
    }
  }

  return result;
}
