import { PROFILE_SITES } from './sites.js';

/**
 * DOMAIN ALLOWLIST
 * ----------------
 * Only domains listed here may be retrieved automatically in Public Source
 * Mode. Everything else is refused *before* a request leaves the process.
 *
 * Profile-site hosts are folded in automatically from `sites.ts`, so a site
 * only has to be registered in one place.
 */

export type DomainSourceType =
  | 'public_profile'
  | 'public_repository'
  | 'official_organization'
  | 'event_listing'
  | 'publication'
  | 'personal_website'
  | 'search_discovery';

export interface AllowedDomain {
  /** Registrable host, matched on exact host or any subdomain. */
  domain: string;
  label: string;
  sourceType: DomainSourceType;
  reliability: 'High' | 'Medium-High' | 'Medium' | 'Low-Medium' | 'Low';
  /** Why automated access to this host is considered permitted. */
  basis: string;
  enabled: boolean;
}

const CORE_DOMAINS: AllowedDomain[] = [
  {
    domain: 'api.github.com',
    label: 'GitHub Public REST',
    sourceType: 'public_repository',
    reliability: 'High',
    basis: 'Unauthenticated public REST endpoints (rate-limited, no token required).',
    enabled: true,
  },
  {
    domain: 'arxiv.org',
    label: 'arXiv',
    sourceType: 'publication',
    reliability: 'High',
    basis: 'Public preprint listings; export endpoints explicitly permitted.',
    enabled: true,
  },
  {
    domain: 'export.arxiv.org',
    label: 'arXiv Export API',
    sourceType: 'publication',
    reliability: 'High',
    basis: 'Documented public export interface intended for automated access.',
    enabled: true,
  },
  {
    domain: 'api.crossref.org',
    label: 'Crossref',
    sourceType: 'publication',
    reliability: 'High',
    basis: 'Public scholarly metadata API; no key required for the polite pool.',
    enabled: true,
  },
  {
    domain: 'duckduckgo.com',
    label: 'DuckDuckGo (HTML endpoint)',
    sourceType: 'search_discovery',
    reliability: 'Low-Medium',
    basis: 'Public no-JavaScript results endpoint. Used only to discover candidate URLs.',
    enabled: true,
  },
  {
    domain: 'lite.duckduckgo.com',
    label: 'DuckDuckGo Lite',
    sourceType: 'search_discovery',
    reliability: 'Low-Medium',
    basis: 'Public lightweight results endpoint.',
    enabled: true,
  },
  {
    domain: 'search.marcia.cc',
    label: 'SearXNG (public instance)',
    sourceType: 'search_discovery',
    reliability: 'Low-Medium',
    basis: 'Public metasearch instance exposing a JSON API.',
    enabled: false,
  },
  {
    domain: 'example.com',
    label: 'Example Technologies (demo fixture)',
    sourceType: 'official_organization',
    reliability: 'High',
    basis: 'Reserved documentation domain used by the organizer demo fixture.',
    enabled: true,
  },
  {
    domain: 'example.org',
    label: 'Prometheus Hackathon (demo fixture)',
    sourceType: 'event_listing',
    reliability: 'Medium-High',
    basis: 'Reserved documentation domain used by the organizer demo fixture.',
    enabled: true,
  },
];

/** Hosts contributed by the profile-site registry. */
const SITE_DOMAINS: AllowedDomain[] = (() => {
  const seen = new Set(CORE_DOMAINS.map((d) => d.domain));
  const out: AllowedDomain[] = [];
  for (const site of PROFILE_SITES) {
    let host: string;
    try {
      host = new URL(site.url.replace('{}', 'x')).hostname;
    } catch {
      continue;
    }
    // Wildcard templates such as {}.substack.com resolve to the apex domain.
    const domain = host.startsWith('x.') ? host.slice(2) : host;
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({
      domain,
      label: site.name,
      sourceType: site.category === 'code' ? 'public_repository' : 'public_profile',
      reliability: site.reliability,
      basis: 'Public, unauthenticated profile pages only; robots.txt is honoured per request.',
      enabled: site.enabled,
    });
  }
  return out;
})();

export const ALLOWED_DOMAINS: AllowedDomain[] = [...CORE_DOMAINS, ...SITE_DOMAINS];

/**
 * Personal sites discovered as links on a retrieved profile are followed even
 * though they cannot be known in advance. They are still subject to robots.txt,
 * the denied-path list, depth and page limits — and are recorded at lower
 * reliability than an allowlisted source.
 */
export const FOLLOW_DISCOVERED_PERSONAL_SITES = true;

/** Never requested on any domain. */
export const DENY_PATH_PATTERNS: RegExp[] = [
  /\/login/i,
  /\/signin/i,
  /\/sign_in/i,
  /\/sign-in/i,
  /\/register/i,
  /\/signup/i,
  /\/oauth/i,
  /\/session/i,
  /\/admin/i,
  /\/settings/i,
  /\/account/i,
  /\/password/i,
  /\/checkout/i,
  /\/cart/i,
];

/** Hosts we never touch, whatever links to them. */
export const DENY_HOSTS: RegExp[] = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)whatsapp\.com$/i,
];

export const CRAWLER_CONFIG = {
  userAgent:
    'DigitalIdentityIntelligence-Prototype/1.0 (hackathon research prototype; public pages only; honours robots.txt)',
  requestTimeoutMs: 9000,
  maxRetries: 1,
  retryBackoffMs: 500,
  /** Requests in flight across all hosts. */
  maxConcurrency: 8,
  /** Minimum gap between two requests to the SAME host. */
  perHostDelayMs: 900,
  maxCrawlDepth: 2,
  maxPagesPerInvestigation: 140,
  maxResponseBytes: 2_000_000,
} as const;

export function findAllowedDomain(hostname: string): AllowedDomain | null {
  const host = hostname.toLowerCase();
  for (const entry of ALLOWED_DOMAINS) {
    if (!entry.enabled) continue;
    if (host === entry.domain || host.endsWith(`.${entry.domain}`)) return entry;
  }
  return null;
}

export function isPathDenied(pathname: string): boolean {
  return DENY_PATH_PATTERNS.some((re) => re.test(pathname));
}

export function isHostDenied(hostname: string): boolean {
  return DENY_HOSTS.some((re) => re.test(hostname));
}
