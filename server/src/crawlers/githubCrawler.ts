import { fetchPublicPage } from './httpClient.js';
import { parseProfile } from '../parsers/profileParser.js';
import { parseProjects, projectNames } from '../parsers/projectParser.js';
import { attemptFrom, buildRecord, emptyResult, handlePermutations, type CrawlInput, type CrawlResult } from './base.js';
import type { EvidenceSnippet } from '../types/index.js';
import { uniq } from '../utils/text.js';

/**
 * GitHub public-source crawler.
 *
 * Works with NO API token. Prefers the unauthenticated public REST endpoints
 * (clean JSON, generous shape) and falls back to parsing the public profile
 * page when REST is unavailable or rate-limited.
 */
export async function crawlGitHub(input: CrawlInput, maxHandles = 4): Promise<CrawlResult> {
  const result = emptyResult();

  const handles = uniq([
    ...input.usernames,
    ...input.names.flatMap((n) => handlePermutations(n)),
  ]).slice(0, maxHandles);

  for (const handle of handles) {
    const apiUrl = `https://api.github.com/users/${encodeURIComponent(handle)}`;
    const apiOutcome = await fetchPublicPage(apiUrl, { accept: 'application/vnd.github+json' });
    result.attempts.push(attemptFrom('GitHub Public REST', apiOutcome));

    if (apiOutcome.ok && apiOutcome.html) {
      try {
        const user = JSON.parse(apiOutcome.html) as Record<string, any>;
        if (user && typeof user.login === 'string') {
          const repos = await fetchRepos(handle, result);
          const evidence: EvidenceSnippet[] = [
            { label: 'Public profile record', excerpt: `login=${user.login}` },
          ];
          if (user.name) evidence.push({ label: 'Display name', excerpt: String(user.name) });
          if (user.bio) evidence.push({ label: 'Public bio', excerpt: String(user.bio) });
          if (user.company)
            evidence.push({ label: 'Organization reference', excerpt: String(user.company) });
          if (repos.length)
            evidence.push({
              label: 'Public repositories',
              excerpt: repos.slice(0, 6).map((r) => r.name).join(', '),
            });

          result.records.push(
            buildRecord({
              source: 'GitHub',
              sourceType: 'public_profile',
              url: user.html_url ?? `https://github.com/${handle}`,
              title: `GitHub profile — ${user.login}`,
              person: user.name ?? null,
              usernames: [user.login],
              organizations: user.company ? [String(user.company).replace(/^@/, '')] : [],
              projects: repos.map((r) => r.name),
              locations: user.location ? [String(user.location)] : [],
              dates: user.created_at ? [String(user.created_at)] : [],
              links: [user.blog, user.html_url].filter(Boolean).map(String),
              avatarUrl: user.avatar_url ?? null,
              bio: user.bio ?? null,
              rawEvidence: evidence,
              provenance: 'PUBLIC_SOURCE',
              reliability: 'High',
            }),
          );

          for (const repo of repos.slice(0, 5)) {
            result.records.push(
              buildRecord({
                source: 'GitHub',
                sourceType: 'public_repository',
                url: repo.url,
                title: `Repository — ${repo.name}`,
                person: user.name ?? null,
                usernames: [user.login],
                projects: [repo.name],
                links: [repo.url],
                rawEvidence: [
                  {
                    label: `Repository ${repo.name}`,
                    excerpt: repo.description ?? `${repo.name} (${repo.language ?? 'language not stated'})`,
                  },
                ],
                provenance: 'PUBLIC_SOURCE',
                reliability: 'High',
              }),
            );
          }
          continue;
        }
      } catch {
        // fall through to HTML parsing
      }
    }

    // Fallback: public profile page.
    const pageUrl = `https://github.com/${encodeURIComponent(handle)}`;
    const pageOutcome = await fetchPublicPage(pageUrl);
    result.attempts.push(attemptFrom('GitHub', pageOutcome));
    if (!pageOutcome.ok || !pageOutcome.html) continue;

    const profile = parseProfile(pageOutcome.html, pageUrl);
    const projects = parseProjects(pageOutcome.html, pageUrl);

    result.records.push(
      buildRecord({
        source: 'GitHub',
        sourceType: 'public_profile',
        url: pageUrl,
        title: `GitHub profile — ${profile.username ?? handle}`,
        person: profile.person,
        usernames: [profile.username ?? handle],
        organizations: profile.organizations,
        projects: projectNames(projects),
        locations: profile.locations,
        links: profile.links,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        rawEvidence: [...profile.evidence, ...projects.evidence],
        provenance: 'PUBLIC_SOURCE',
        reliability: 'High',
      }),
    );
  }

  return result;
}

async function fetchRepos(
  handle: string,
  result: CrawlResult,
): Promise<{ name: string; description: string | null; language: string | null; url: string }[]> {
  const url = `https://api.github.com/users/${encodeURIComponent(handle)}/repos?per_page=20&sort=updated`;
  const outcome = await fetchPublicPage(url, { accept: 'application/vnd.github+json' });
  result.attempts.push(attemptFrom('GitHub Public REST', outcome));
  if (!outcome.ok || !outcome.html) return [];
  try {
    const list = JSON.parse(outcome.html) as Record<string, any>[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => !r.fork)
      .map((r) => ({
        name: String(r.name),
        description: r.description ? String(r.description) : null,
        language: r.language ? String(r.language) : null,
        url: String(r.html_url),
      }));
  } catch {
    return [];
  }
}
