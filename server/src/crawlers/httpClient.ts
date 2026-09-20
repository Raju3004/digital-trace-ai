import {
  CRAWLER_CONFIG,
  findAllowedDomain,
  isHostDenied,
  isPathDenied,
} from '../config/allowlist.js';
import type { FetchOutcome } from '../types/index.js';
import { isAllowedByRobots } from './robots.js';

/** Per-host timestamp of the last request, for polite rate limiting. */
const lastRequestAt = new Map<string, number>();
/** Per-host delay, raised when a host's robots.txt asks for more. */
const hostDelay = new Map<string, number>();

/** URLs already requested in this investigation — duplicate detection. */
const seenUrls = new Set<string>();

/** Hosts explicitly opened for this investigation (discovered personal sites). */
const sessionAllowedHosts = new Set<string>();

let pagesFetched = 0;
let inFlight = 0;
const queue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < CRAWLER_CONFIG.maxConcurrency) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  inFlight += 1;
}

function releaseSlot(): void {
  inFlight -= 1;
  const next = queue.shift();
  if (next) next();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function respectHostDelay(host: string): Promise<void> {
  const required = hostDelay.get(host) ?? CRAWLER_CONFIG.perHostDelayMs;
  const last = lastRequestAt.get(host) ?? 0;
  const wait = required - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

export function resetCrawlSession(): void {
  seenUrls.clear();
  sessionAllowedHosts.clear();
  pagesFetched = 0;
}

/** Opens a host discovered as a link on an already-retrieved public profile. */
export function allowDiscoveredHost(hostname: string): void {
  sessionAllowedHosts.add(hostname.toLowerCase());
}

export function hasSeen(url: string): boolean {
  return seenUrls.has(normalizeUrl(url));
}

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

/**
 * Retrieve a public page.
 *
 * Refuses, before any network access, anything that is:
 *   - on a denied host (major social networks that forbid scraping outright)
 *   - not on the domain allowlist and not a host opened by discovery
 *   - on a denied path pattern (login / auth / admin / settings ...)
 *   - disallowed for our User-Agent by the host's robots.txt
 *
 * Never throws and never fabricates a body.
 */
export async function fetchPublicPage(
  rawUrl: string,
  opts: { accept?: string; allowUnlisted?: boolean } = {},
): Promise<FetchOutcome> {
  const started = Date.now();
  const url = normalizeUrl(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, ok: false, reason: 'Malformed URL.', elapsedMs: 0, blockedBy: 'network' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { url, ok: false, reason: 'Unsupported protocol.', elapsedMs: 0, blockedBy: 'allowlist' };
  }

  if (seenUrls.has(url)) {
    return {
      url,
      ok: false,
      reason: 'Duplicate URL — already requested in this investigation.',
      elapsedMs: 0,
      blockedBy: 'allowlist',
    };
  }

  if (pagesFetched >= CRAWLER_CONFIG.maxPagesPerInvestigation) {
    return {
      url,
      ok: false,
      reason: `Page budget for this investigation reached (${CRAWLER_CONFIG.maxPagesPerInvestigation}).`,
      elapsedMs: 0,
      blockedBy: 'rate_limit',
    };
  }

  const host = parsed.hostname.toLowerCase();

  if (isHostDenied(host)) {
    return {
      url,
      ok: false,
      reason: `"${host}" forbids automated access in its terms — never requested.`,
      elapsedMs: Date.now() - started,
      blockedBy: 'allowlist',
    };
  }

  const allowed =
    findAllowedDomain(host) ??
    (sessionAllowedHosts.has(host) || opts.allowUnlisted ? null : undefined);

  if (allowed === undefined) {
    return {
      url,
      ok: false,
      reason: `Domain "${host}" is not on the configured allowlist. Automated retrieval refused.`,
      elapsedMs: Date.now() - started,
      blockedBy: 'allowlist',
    };
  }

  if (isPathDenied(parsed.pathname)) {
    return {
      url,
      ok: false,
      reason: 'Path matches a restricted pattern (authentication / account area). Not requested.',
      elapsedMs: Date.now() - started,
      blockedBy: 'allowlist',
    };
  }

  const robots = await isAllowedByRobots(parsed);
  if (robots.crawlDelayMs) {
    hostDelay.set(host, Math.max(hostDelay.get(host) ?? 0, robots.crawlDelayMs));
  }
  if (!robots.allowed) {
    return {
      url,
      ok: false,
      reason: robots.reason,
      elapsedMs: Date.now() - started,
      blockedBy: 'robots',
    };
  }

  seenUrls.add(url);
  await acquireSlot();
  try {
    let lastReason = 'Source unavailable for automated retrieval.';
    let lastBlocked: FetchOutcome['blockedBy'] = 'network';

    for (let attempt = 0; attempt <= CRAWLER_CONFIG.maxRetries; attempt++) {
      await respectHostDelay(host);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CRAWLER_CONFIG.requestTimeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': CRAWLER_CONFIG.userAgent,
            Accept:
              opts.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en',
          },
        });
        clearTimeout(timer);

        if (res.status === 404 || res.status === 410) {
          return {
            url,
            ok: false,
            status: res.status,
            reason: `No public page at this address (HTTP ${res.status}).`,
            elapsedMs: Date.now() - started,
            blockedBy: 'http',
          };
        }

        if (res.status === 429 || res.status === 503) {
          return {
            url,
            ok: false,
            status: res.status,
            reason: `Source rate-limited the request (HTTP ${res.status}). Backing off rather than retrying.`,
            elapsedMs: Date.now() - started,
            blockedBy: 'rate_limit',
          };
        }

        if (res.status === 401 || res.status === 403) {
          return {
            url,
            ok: false,
            status: res.status,
            reason: `Source refused automated access (HTTP ${res.status}). Not retried, and no attempt is made to work around it.`,
            elapsedMs: Date.now() - started,
            blockedBy: 'http',
          };
        }

        if (!res.ok) {
          lastReason = `Source returned HTTP ${res.status}.`;
          lastBlocked = 'http';
          if (res.status >= 400 && res.status < 500) break;
          continue;
        }

        const html = await readBounded(res);
        pagesFetched += 1;
        return { url, ok: true, status: res.status, html, elapsedMs: Date.now() - started };
      } catch (err) {
        clearTimeout(timer);
        const aborted = err instanceof Error && err.name === 'AbortError';
        lastReason = aborted
          ? `Request timed out after ${CRAWLER_CONFIG.requestTimeoutMs}ms.`
          : `Network error: ${err instanceof Error ? err.message : 'unknown'}.`;
        lastBlocked = aborted ? 'timeout' : 'network';
        if (attempt < CRAWLER_CONFIG.maxRetries) {
          await sleep(CRAWLER_CONFIG.retryBackoffMs * (attempt + 1));
        }
      }
    }

    return {
      url,
      ok: false,
      reason: lastReason,
      elapsedMs: Date.now() - started,
      blockedBy: lastBlocked,
    };
  } finally {
    releaseSlot();
  }
}

/**
 * Retrieves a published image (an avatar) as bytes, under exactly the same
 * allowlist, robots.txt, denied-path and rate-limit rules as a page fetch.
 * Used only to compare against an authorized photograph.
 */
export async function fetchPublicImage(
  rawUrl: string,
): Promise<{ ok: boolean; buffer?: Buffer; reason?: string }> {
  const url = normalizeUrl(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Malformed image URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (isHostDenied(host)) return { ok: false, reason: `Host "${host}" is on the deny list.` };

  // Avatars are commonly served from a CDN subdomain of the profile host, so
  // allow a host already opened by discovery as well as the static allowlist.
  if (!findAllowedDomain(host) && !sessionAllowedHosts.has(host)) {
    return { ok: false, reason: `Image host "${host}" is not allowlisted.` };
  }

  const robots = await isAllowedByRobots(parsed);
  if (!robots.allowed) return { ok: false, reason: robots.reason };

  await acquireSlot();
  try {
    await respectHostDelay(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CRAWLER_CONFIG.requestTimeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': CRAWLER_CONFIG.userAgent, Accept: 'image/*' },
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false, reason: `Image request returned HTTP ${res.status}.` };

    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) {
      return { ok: false, reason: `Expected an image, received "${type || 'unknown type'}".` };
    }

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > 6_000_000) {
      return { ok: false, reason: 'Image exceeds the 6 MB comparison limit.' };
    }
    return { ok: true, buffer: Buffer.from(bytes) };
  } catch (err) {
    return {
      ok: false,
      reason: `Image could not be retrieved: ${err instanceof Error ? err.message : 'unknown error'}.`,
    };
  } finally {
    releaseSlot();
  }
}

async function readBounded(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const decoder = new TextDecoder();
  let html = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > CRAWLER_CONFIG.maxResponseBytes) {
      await reader.cancel();
      break;
    }
    html += decoder.decode(value, { stream: true });
  }
  return html;
}
