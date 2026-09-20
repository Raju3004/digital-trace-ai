/**
 * PUBLIC PROFILE SITE REGISTRY
 * ----------------------------
 * Used by the username crawler to test whether a handle exists as a PUBLIC
 * profile page on each site. Only public, unauthenticated profile URLs.
 *
 * Existence is decided by:
 *   1. HTTP status (404 / 410 → does not exist), then
 *   2. `absenceMarkers` — many sites answer 200 with a "not found" page, so we
 *      also look for their specific not-found wording before claiming a hit.
 *
 * Add or disable sites here; nothing else needs to change.
 */

export interface ProfileSite {
  id: string;
  name: string;
  /** `{}` is replaced with the handle. */
  url: string;
  category: 'code' | 'social' | 'writing' | 'professional' | 'design' | 'academic' | 'other';
  reliability: 'High' | 'Medium-High' | 'Medium' | 'Low-Medium' | 'Low';
  /** Case-insensitive strings that mean "this profile does not exist". */
  absenceMarkers?: string[];
  /** Skip handles that cannot be valid on this site. */
  handlePattern?: RegExp;
  enabled: boolean;
  /** Sites that commonly challenge automated clients; failures here are expected. */
  bestEffort?: boolean;
}

export const PROFILE_SITES: ProfileSite[] = [
  // ---------------------------------------------------------------- code
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/{}',
    category: 'code',
    reliability: 'High',
    absenceMarkers: ['page not found', 'this is not the web page you are looking for'],
    handlePattern: /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
    enabled: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.com/{}',
    category: 'code',
    reliability: 'High',
    absenceMarkers: ['page not found', '404'],
    enabled: true,
  },
  {
    id: 'codeberg',
    name: 'Codeberg',
    url: 'https://codeberg.org/{}',
    category: 'code',
    reliability: 'High',
    absenceMarkers: ['page not found'],
    enabled: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    url: 'https://huggingface.co/{}',
    category: 'code',
    reliability: 'High',
    absenceMarkers: ['not found', "we couldn't find"],
    enabled: true,
  },
  {
    id: 'npm',
    name: 'npm',
    url: 'https://www.npmjs.com/~{}',
    category: 'code',
    reliability: 'High',
    absenceMarkers: ['not found', "couldn't find that page"],
    enabled: true,
  },
  {
    id: 'pypi',
    name: 'PyPI',
    url: 'https://pypi.org/user/{}/',
    category: 'code',
    reliability: 'High',
    absenceMarkers: ['page not found'],
    enabled: true,
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub',
    url: 'https://hub.docker.com/u/{}',
    category: 'code',
    reliability: 'Medium-High',
    absenceMarkers: ['page not found'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'replit',
    name: 'Replit',
    url: 'https://replit.com/@{}',
    category: 'code',
    reliability: 'Medium',
    absenceMarkers: ['404', 'not found'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'kaggle',
    name: 'Kaggle',
    url: 'https://www.kaggle.com/{}',
    category: 'code',
    reliability: 'Medium-High',
    absenceMarkers: ['404', 'not found'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'leetcode',
    name: 'LeetCode',
    url: 'https://leetcode.com/u/{}/',
    category: 'code',
    reliability: 'Medium',
    absenceMarkers: ['404', 'page not found'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'hackerrank',
    name: 'HackerRank',
    url: 'https://www.hackerrank.com/profile/{}',
    category: 'code',
    reliability: 'Medium',
    absenceMarkers: ['not found', '404'],
    enabled: true,
    bestEffort: true,
  },

  // ------------------------------------------------------------- writing
  {
    id: 'devto',
    name: 'DEV Community',
    url: 'https://dev.to/{}',
    category: 'writing',
    reliability: 'Medium-High',
    absenceMarkers: ['page not found', 'this page does not exist'],
    enabled: true,
  },
  {
    id: 'hashnode',
    name: 'Hashnode',
    url: 'https://hashnode.com/@{}',
    category: 'writing',
    reliability: 'Medium',
    absenceMarkers: ['not found', '404'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'medium',
    name: 'Medium',
    url: 'https://medium.com/@{}',
    category: 'writing',
    reliability: 'Medium',
    absenceMarkers: ['out of nothing, something', 'page not found'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'substack',
    name: 'Substack',
    url: 'https://{}.substack.com/',
    category: 'writing',
    reliability: 'Medium',
    absenceMarkers: ['there is nothing here', 'page not found'],
    handlePattern: /^[a-z\d][a-z\d-]{1,38}$/i,
    enabled: true,
    bestEffort: true,
  },

  // -------------------------------------------------------------- social
  {
    id: 'reddit',
    name: 'Reddit',
    url: 'https://www.reddit.com/user/{}/about.json',
    category: 'social',
    reliability: 'Medium',
    absenceMarkers: ['"error": 404', 'nobody on reddit goes by that name'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'mastodon',
    name: 'Mastodon (mastodon.social)',
    url: 'https://mastodon.social/@{}',
    category: 'social',
    reliability: 'Medium',
    absenceMarkers: ['the page you are looking for', 'not found'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    url: 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={}.bsky.social',
    category: 'social',
    reliability: 'Medium',
    absenceMarkers: ['profile not found', 'invalidrequest'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://t.me/{}',
    category: 'social',
    reliability: 'Low-Medium',
    absenceMarkers: ['tgme_page_not_found', 'if you have telegram'],
    enabled: false,
    bestEffort: true,
  },

  // --------------------------------------------------------------- design
  {
    id: 'behance',
    name: 'Behance',
    url: 'https://www.behance.net/{}',
    category: 'design',
    reliability: 'Medium',
    absenceMarkers: ['page not found', 'oops'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'dribbble',
    name: 'Dribbble',
    url: 'https://dribbble.com/{}',
    category: 'design',
    reliability: 'Medium',
    absenceMarkers: ['page not found', "we couldn't find"],
    enabled: true,
    bestEffort: true,
  },

  // --------------------------------------------------------------- other
  {
    id: 'aboutme',
    name: 'about.me',
    url: 'https://about.me/{}',
    category: 'other',
    reliability: 'Medium',
    absenceMarkers: ['page not found', '404'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'linktree',
    name: 'Linktree',
    url: 'https://linktr.ee/{}',
    category: 'other',
    reliability: 'Medium',
    absenceMarkers: ['the page you’re looking for doesn’t exist', "doesn't exist"],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'devpost',
    name: 'Devpost',
    url: 'https://devpost.com/{}',
    category: 'other',
    reliability: 'Medium-High',
    absenceMarkers: ['page not found', '404'],
    enabled: true,
    bestEffort: true,
  },
  {
    id: 'gravatar',
    name: 'Gravatar',
    url: 'https://gravatar.com/{}',
    category: 'other',
    reliability: 'Medium',
    absenceMarkers: ['not found', '404'],
    enabled: true,
    bestEffort: true,
  },
];

export function enabledSites(): ProfileSite[] {
  return PROFILE_SITES.filter((s) => s.enabled);
}

export function siteHosts(): string[] {
  const hosts = new Set<string>();
  for (const site of PROFILE_SITES) {
    try {
      // Substitute a dummy handle so the template parses as a URL.
      hosts.add(new URL(site.url.replace('{}', 'x')).hostname);
    } catch {
      /* ignore malformed template */
    }
  }
  return [...hosts];
}
