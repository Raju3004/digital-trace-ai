import * as cheerio from 'cheerio';
import { fetchPublicPage } from './httpClient.js';
import { enabledSites, type ProfileSite } from '../config/sites.js';
import {
  attemptFrom,
  buildRecord,
  emptyResult,
  handlePermutations,
  type CrawlInput,
  type CrawlResult,
} from './base.js';
import type { EvidenceSnippet, SourceType } from '../types/index.js';
import { uniq } from '../utils/text.js';

const CATEGORY_TO_SOURCE_TYPE: Record<ProfileSite['category'], SourceType> = {
  code: 'public_repository',
  social: 'public_profile',
  writing: 'public_profile',
  professional: 'public_profile',
  design: 'public_profile',
  academic: 'publication',
  other: 'public_profile',
};

/**
 * USERNAME ENUMERATION
 *
 * The primary discovery mechanism. For each candidate handle we test every
 * enabled site for a public profile page, then read whatever the page states
 * about the person from its Open Graph / JSON-LD metadata.
 *
 * This is what makes the system work without reverse image search: instead of
 * asking "which faces match?", we find candidate profiles by handle and then
 * correlate them on many independent attributes.
 */
export async function crawlUsernames(
  input: CrawlInput,
  opts: { maxHandles?: number; onHit?: (site: string, url: string) => void } = {},
): Promise<CrawlResult> {
  const result = emptyResult();
  const sites = enabledSites();

  const handles = uniq([
    ...input.usernames.map((u) => u.trim()).filter(Boolean),
    ...input.names.flatMap((n) => handlePermutations(n)),
  ])
    .filter((h) => h.length >= 2 && h.length <= 39)
    .slice(0, opts.maxHandles ?? 4);

  if (!handles.length) return result;

  // Build the full task list, then let the shared http client apply its
  // concurrency ceiling and per-host pacing.
  const tasks: { site: ProfileSite; handle: string; url: string }[] = [];
  for (const handle of handles) {
    for (const site of sites) {
      if (site.handlePattern && !site.handlePattern.test(handle)) continue;
      tasks.push({ site, handle, url: site.url.replace('{}', encodeURIComponent(handle)) });
    }
  }

  const outcomes = await Promise.all(
    tasks.map(async ({ site, handle, url }) => {
      const outcome = await fetchPublicPage(url);
      return { site, handle, url, outcome };
    }),
  );

  for (const { site, handle, url, outcome } of outcomes) {
    result.attempts.push(attemptFrom(site.name, outcome));
    if (!outcome.ok || !outcome.html) continue;

    const verdict = classifyResponse(site, handle, outcome.html);
    if (verdict.kind !== 'profile') {
      // A 200 response is not a hit. It may be a soft-404, or an anti-bot
      // interstitial — which we report and never try to work around.
      result.attempts[result.attempts.length - 1] = {
        ...result.attempts[result.attempts.length - 1],
        ok: false,
        blockedBy: verdict.kind === 'challenge' ? 'http' : undefined,
        reason: verdict.reason,
      };
      continue;
    }

    opts.onHit?.(site.name, url);

    const extracted = extractProfile(outcome.html, url, site);
    result.records.push(
      buildRecord({
        source: site.name,
        sourceType: CATEGORY_TO_SOURCE_TYPE[site.category],
        url,
        title: `${site.name} profile — ${handle}`,
        person: extracted.displayName,
        usernames: [handle],
        organizations: extracted.organizations,
        roles: extracted.roles,
        projects: extracted.projects,
        locations: extracted.locations,
        links: uniq([url, ...extracted.links]),
        avatarUrl: extracted.avatarUrl,
        bio: extracted.bio,
        rawEvidence: extracted.evidence,
        provenance: 'PUBLIC_SOURCE',
        reliability: site.reliability,
      }),
    );
  }

  return result;
}

/**
 * Signatures of anti-bot interstitials, consent walls and CDN challenges.
 * These arrive with HTTP 200 and would otherwise be read as a valid profile
 * for EVERY handle tested — the single biggest source of false positives.
 *
 * We detect them, record the source as refusing automated access, and move on.
 * No attempt is made to solve or bypass them.
 */
/** Page titles that mean "you got the interstitial, not the content". */
const CHALLENGE_TITLES = [
  'client challenge',
  'just a moment',
  'attention required',
  'access denied',
  'security check',
  'are you a robot',
  'verify you are human',
  'bot verification',
  'one moment, please',
  'pardon our interruption',
];

/**
 * Body signatures, only trusted on SMALL pages. A real profile page is tens or
 * hundreds of kilobytes and may legitimately contain the word "captcha" in
 * hidden markup, so matching these on a full page produces false positives.
 */
const CHALLENGE_BODY_SIGNATURES = [
  'cf-browser-verification',
  'cf_chl_opt',
  'checking your browser before accessing',
  'enable javascript and cookies to continue',
  'request unsuccessful. incapsula',
  'ddos protection by',
  'px-captcha',
  'unusual traffic from your computer',
];

/** Challenge pages are small; real content pages are not. */
const CHALLENGE_MAX_BYTES = 15_000;

type Verdict =
  | { kind: 'profile' }
  | { kind: 'absent'; reason: string }
  | { kind: 'challenge'; reason: string };

/**
 * Decides whether a 200 response is really a public profile.
 *
 * Requires POSITIVE confirmation rather than merely the absence of a
 * not-found string: a genuine profile page names the handle, or publishes
 * structured person metadata. Anything else is reported, not guessed at.
 */
function classifyResponse(site: ProfileSite, handle: string, html: string): Verdict {
  const head = html.slice(0, 80_000);
  const lower = head.toLowerCase();
  const title = (/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ?? '').trim().toLowerCase();

  const titleHit = CHALLENGE_TITLES.find((sig) => title.includes(sig));
  if (titleHit) {
    return {
      kind: 'challenge',
      reason: `${site.name} served an anti-bot interstitial titled "${title}" instead of content. Reported as unavailable; no bypass attempted.`,
    };
  }

  if (html.length <= CHALLENGE_MAX_BYTES) {
    const bodyHit = CHALLENGE_BODY_SIGNATURES.find((sig) => lower.includes(sig));
    if (bodyHit) {
      return {
        kind: 'challenge',
        reason: `${site.name} served a bot-protection page ("${bodyHit}") instead of content. Reported as unavailable; no bypass attempted.`,
      };
    }
  }

  // Suspiciously small bodies are almost always interstitials or error shells.
  if (html.length < 500) {
    return {
      kind: 'absent',
      reason: `${site.name} returned an empty or placeholder body (${html.length} bytes) — not treated as a profile.`,
    };
  }

  const marker = site.absenceMarkers?.find((m) => lower.includes(m.toLowerCase()));
  if (marker) {
    return {
      kind: 'absent',
      reason: `No public profile for "${handle}" on ${site.name} (page body says "${marker}").`,
    };
  }

  // Positive confirmation.
  const handleLower = handle.toLowerCase();
  const mentionsHandle = lower.includes(handleLower);
  const hasPersonData =
    /"@type"\s*:\s*"(person|profilepage)"/i.test(head) ||
    /<meta[^>]+property=["']og:(title|image)["']/i.test(head);

  if (!mentionsHandle && !hasPersonData) {
    return {
      kind: 'absent',
      reason: `${site.name} returned a page that neither names "${handle}" nor publishes profile metadata — not treated as a match.`,
    };
  }

  return { kind: 'profile' };
}

interface ExtractedProfile {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  locations: string[];
  organizations: string[];
  roles: string[];
  projects: string[];
  links: string[];
  evidence: EvidenceSnippet[];
}

/**
 * Reads what the page itself publishes. Prefers structured data (JSON-LD,
 * Open Graph) because those are stable across sites and redesigns.
 */
function extractProfile(html: string, pageUrl: string, site: ProfileSite): ExtractedProfile {
  const out: ExtractedProfile = {
    displayName: null,
    bio: null,
    avatarUrl: null,
    locations: [],
    organizations: [],
    roles: [],
    projects: [],
    links: [],
    evidence: [],
  };

  // Reddit and Bluesky answer JSON, not HTML.
  const trimmed = html.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(html);
      const d = json.data ?? json;
      out.displayName = str(d.displayName ?? d.display_name ?? d.name ?? d.subreddit?.title);
      out.bio =
        str(d.description ?? d.public_description ?? d.subreddit?.public_description) ?? null;
      out.avatarUrl = str(d.avatar ?? d.icon_img ?? d.subreddit?.icon_img) ?? null;
      if (out.displayName) out.evidence.push({ label: 'Display name', excerpt: out.displayName });
      if (out.bio) out.evidence.push({ label: 'Public bio', excerpt: out.bio.slice(0, 240) });
      return out;
    } catch {
      /* fall through to HTML parsing */
    }
  }

  const $ = cheerio.load(html);

  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr('content')?.trim() ||
    $(`meta[name="${name}"]`).attr('content')?.trim() ||
    null;

  // --- JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text();
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = String(node['@type'] ?? '').toLowerCase();
        if (type.includes('person') || type.includes('profilepage')) {
          out.displayName ??= str(node.name);
          out.bio ??= str(node.description);
          const img = node.image;
          out.avatarUrl ??= str(typeof img === 'string' ? img : img?.url);
          const worksFor = node.worksFor;
          const orgName = str(typeof worksFor === 'string' ? worksFor : worksFor?.name);
          if (orgName) out.organizations.push(orgName);
          const jobTitle = str(node.jobTitle);
          if (jobTitle) out.roles.push(jobTitle);
          const address = node.address;
          const loc = str(
            typeof address === 'string' ? address : address?.addressLocality ?? node.homeLocation?.name,
          );
          if (loc) out.locations.push(loc);
          const sameAs = node.sameAs;
          if (Array.isArray(sameAs)) out.links.push(...sameAs.filter((s: unknown) => typeof s === 'string'));
          out.evidence.push({ label: 'Structured profile data (JSON-LD)', excerpt: str(node.name) ?? 'Person record' });
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  // --- Open Graph / Twitter cards
  const ogTitle = meta('og:title') ?? meta('twitter:title');
  const ogDesc = meta('og:description') ?? meta('twitter:description') ?? meta('description');
  const ogImage = meta('og:image') ?? meta('twitter:image');

  if (!out.displayName && ogTitle) out.displayName = cleanDisplayName(ogTitle, site, handleOf(pageUrl));
  out.bio ??= ogDesc;
  out.avatarUrl ??= ogImage;

  // --- Site-specific selectors worth having, with generic fallbacks.
  if (site.id === 'github') {
    out.displayName = $('.vcard-names .p-name').first().text().trim() || out.displayName;
    const note = $('.p-note .user-profile-bio').first().text().trim();
    if (note) out.bio = note;
    const org = $('.vcard-details [itemprop="worksFor"]').first().text().trim();
    if (org) out.organizations.push(org.replace(/^@/, ''));
    const loc = $('.vcard-details [itemprop="homeLocation"]').first().text().trim();
    if (loc) out.locations.push(loc);
    $('.vcard-details a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) out.links.push(href);
    });
    $('.pinned-item-list-item .repo').each((_, el) => {
      const name = $(el).text().trim();
      if (name) out.projects.push(name);
    });
  }

  if (!out.locations.length) {
    const loc = $('[itemprop="homeLocation"], .p-label, [data-location]').first().text().trim();
    if (loc && loc.length < 80) out.locations.push(loc);
  }

  // Outbound links the profile itself publishes — these drive iterative discovery.
  if (out.links.length < 8) {
    $('a[rel~="me"], a[rel~="nofollow"][href^="http"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href?.startsWith('http')) out.links.push(href);
    });
  }

  out.organizations = uniq(out.organizations.filter(Boolean)).slice(0, 5);
  out.roles = uniq(out.roles.filter(Boolean)).slice(0, 5);
  out.locations = uniq(out.locations.filter(Boolean)).slice(0, 3);
  out.projects = uniq(out.projects.filter(Boolean)).slice(0, 10);
  out.links = uniq(out.links.filter((l) => l.startsWith('http'))).slice(0, 12);

  if (out.displayName) out.evidence.push({ label: 'Display name', excerpt: out.displayName });
  if (out.bio) out.evidence.push({ label: 'Public bio', excerpt: out.bio.slice(0, 240) });
  if (out.organizations.length)
    out.evidence.push({ label: 'Organization reference', excerpt: out.organizations.join(', ') });
  if (out.locations.length)
    out.evidence.push({ label: 'Stated location', excerpt: out.locations.join(', ') });
  if (out.links.length)
    out.evidence.push({ label: 'Linked profiles', excerpt: out.links.slice(0, 4).join(' · ') });
  if (!out.evidence.length)
    out.evidence.push({ label: 'Public profile page', excerpt: `Profile page exists at ${pageUrl}` });

  return out;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function handleOf(pageUrl: string): string {
  try {
    const segs = new URL(pageUrl).pathname.split('/').filter(Boolean);
    return decodeURIComponent(segs[segs.length - 1] ?? '').replace(/^[@~]/, '');
  } catch {
    return '';
  }
}

/**
 * Turns a page title into a person's name, or null.
 *
 * Titles arrive in many shapes — "Jane Doe (@jdoe) · GitHub",
 * "jdoe - Overview", "Jane Doe | Dribbble". When what is left after cleaning
 * is just the handle again, the site published no real name, and we say so
 * rather than passing the handle off as a display name.
 */
function cleanDisplayName(title: string, site: ProfileSite, handle: string): string | null {
  let name = title
    .replace(/\(@[^)]+\)/g, ' ')
    .replace(/\s+[-–—|·•]\s+(overview|profile|repositories|home|posts|about)\b.*$/i, ' ')
    .replace(new RegExp(`\\s*[-–—|·•]\\s*${escapeRegExp(site.name)}\\s*$`, 'i'), ' ')
    .split(/\s+[|·•]\s+/)[0]
    .replace(/\s+/g, ' ')
    .trim();

  // Trailing site name without a separator, e.g. "Jane Doe GitHub".
  name = name.replace(new RegExp(`\\s+${escapeRegExp(site.name)}$`, 'i'), '').trim();

  if (!name) return null;
  if (name.length > 80) return null;

  const normalizedName = name.toLowerCase().replace(/[^a-z\d]/g, '');
  const normalizedHandle = handle.toLowerCase().replace(/[^a-z\d]/g, '');
  if (normalizedHandle && normalizedName === normalizedHandle) return null;

  return name;
}

function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
