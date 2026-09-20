import { CRAWLER_CONFIG } from '../config/allowlist.js';

interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
  fetchedAt: number;
  /** How the host answered when we asked for robots.txt. */
  outcome: 'rules' | 'allow_all' | 'deny_all';
  detail: string;
}

const cache = new Map<string, RobotsRules>();
const TTL_MS = 10 * 60 * 1000;

/**
 * robots.txt handling, following RFC 9309 §2.3.1 ("Access results").
 *
 *   2xx  → parse and obey the rules.
 *   3xx  → follow redirects (fetch does this for us).
 *   4xx  → "Unavailable". The crawler MAY access any resource. Treat as allow-all.
 *   5xx  → "Unreachable". Treat as complete disallow.
 *   network failure → treat as unreachable, i.e. disallow.
 *
 * The 4xx case matters in practice: a great many hosts answer 403 or 404 for
 * /robots.txt (or sit behind a proxy that does). Refusing those would silently
 * disable most of the discovery engine, which is exactly the bug this replaces.
 */
async function loadRobots(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;

  const base: RobotsRules = {
    disallow: [],
    allow: [],
    crawlDelayMs: null,
    fetchedAt: Date.now(),
    outcome: 'allow_all',
    detail: '',
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': CRAWLER_CONFIG.userAgent, Accept: 'text/plain,*/*' },
    });
    clearTimeout(timer);

    if (res.status >= 400 && res.status < 500) {
      base.outcome = 'allow_all';
      base.detail = `robots.txt unavailable (HTTP ${res.status}) — RFC 9309 permits access.`;
      cache.set(origin, base);
      return base;
    }

    if (res.status >= 500) {
      base.outcome = 'deny_all';
      base.detail = `robots.txt unreachable (HTTP ${res.status}) — treating as full disallow.`;
      cache.set(origin, base);
      return base;
    }

    const text = (await res.text()).slice(0, 250_000);
    const parsed = parseRobots(text);
    base.allow = parsed.allow;
    base.disallow = parsed.disallow;
    base.crawlDelayMs = parsed.crawlDelayMs;
    base.outcome = 'rules';
    base.detail = `robots.txt parsed: ${parsed.disallow.length} disallow rule(s) for our agent.`;
    cache.set(origin, base);
    return base;
  } catch (err) {
    base.outcome = 'deny_all';
    base.detail = `robots.txt could not be fetched (${
      err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network error'
    }) — treating as full disallow.`;
    cache.set(origin, base);
    return base;
  }
}

function parseRobots(text: string): { allow: string[]; disallow: string[]; crawlDelayMs: number | null } {
  // Our product token, e.g. "DigitalIdentityIntelligence-Prototype".
  const ourToken = CRAWLER_CONFIG.userAgent.split('/')[0].trim().toLowerCase();

  const groups = new Map<string, { allow: string[]; disallow: string[]; crawlDelay: number | null }>();
  let currentAgents: string[] = [];
  let expectingAgents = false;

  const ensure = (agent: string) => {
    if (!groups.has(agent)) groups.set(agent, { allow: [], disallow: [], crawlDelay: null });
    return groups.get(agent)!;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      // Consecutive User-agent lines share one group of rules.
      if (!expectingAgents) {
        currentAgents = [];
        expectingAgents = true;
      }
      currentAgents.push(value.toLowerCase());
      ensure(value.toLowerCase());
      continue;
    }

    expectingAgents = false;
    if (!currentAgents.length) continue;

    for (const agent of currentAgents) {
      const bucket = ensure(agent);
      if (field === 'allow' && value) bucket.allow.push(value);
      else if (field === 'disallow') bucket.disallow.push(value);
      else if (field === 'crawl-delay') {
        const n = Number(value);
        if (Number.isFinite(n)) bucket.crawlDelay = n;
      }
    }
  }

  // Most specific match wins: our exact token, else the wildcard group.
  const chosen =
    [...groups.entries()].find(([agent]) => agent === ourToken)?.[1] ??
    [...groups.entries()].find(([agent]) => ourToken.includes(agent) && agent !== '*')?.[1] ??
    groups.get('*');

  if (!chosen) return { allow: [], disallow: [], crawlDelayMs: null };

  return {
    allow: chosen.allow.filter(Boolean),
    // An empty Disallow value means "allow everything" — drop it.
    disallow: chosen.disallow.filter((d) => d.length > 0),
    crawlDelayMs: chosen.crawlDelay !== null ? Math.min(chosen.crawlDelay * 1000, 10_000) : null,
  };
}

function pathMatches(pattern: string, pathname: string): boolean {
  if (!pattern) return false;

  const mustEnd = pattern.endsWith('$');
  const body = mustEnd ? pattern.slice(0, -1) : pattern;

  const escaped = body.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

  try {
    return new RegExp(`^${escaped}${mustEnd ? '$' : ''}`).test(pathname);
  } catch {
    return pathname.startsWith(body);
  }
}

export interface RobotsDecision {
  allowed: boolean;
  reason: string;
  crawlDelayMs: number | null;
}

export async function isAllowedByRobots(url: URL): Promise<RobotsDecision> {
  const rules = await loadRobots(url.origin);

  if (rules.outcome === 'deny_all') {
    return { allowed: false, reason: rules.detail, crawlDelayMs: null };
  }

  if (rules.outcome === 'allow_all') {
    return { allowed: true, reason: rules.detail, crawlDelayMs: null };
  }

  const path = url.pathname + url.search;

  const allowMatch = rules.allow
    .filter((p) => pathMatches(p, path))
    .sort((a, b) => b.length - a.length)[0];
  const disallowMatch = rules.disallow
    .filter((p) => pathMatches(p, path))
    .sort((a, b) => b.length - a.length)[0];

  // Longest match wins; on a tie, Allow wins (RFC 9309 §2.2.2).
  if (disallowMatch && (!allowMatch || allowMatch.length < disallowMatch.length)) {
    return {
      allowed: false,
      reason: `Blocked by robots.txt rule "Disallow: ${disallowMatch}" on ${url.hostname}.`,
      crawlDelayMs: rules.crawlDelayMs,
    };
  }

  return {
    allowed: true,
    reason: 'Permitted by robots.txt.',
    crawlDelayMs: rules.crawlDelayMs,
  };
}
