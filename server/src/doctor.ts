/**
 * SOURCE DOCTOR
 *
 * Reports which public sources this machine can actually reach, and how each
 * one answers robots.txt. Run it before a demo:
 *
 *   npm run doctor
 *
 * A source can fail for reasons that have nothing to do with this code — a
 * corporate proxy, a captive portal, a country block, or the site's own bot
 * protection. This tells you which, so you know what to expect on stage.
 */
import { PROFILE_SITES } from './config/sites.js';
import { CRAWLER_CONFIG } from './config/allowlist.js';
import { isAllowedByRobots } from './crawlers/robots.js';

const PROBE_HANDLE = process.argv[2] ?? 'torvalds';

const CORE_ENDPOINTS = [
  { name: 'GitHub public REST', url: `https://api.github.com/users/${PROBE_HANDLE}` },
  { name: 'DuckDuckGo HTML', url: 'https://html.duckduckgo.com/html/?q=test' },
  { name: 'arXiv export API', url: 'https://export.arxiv.org/api/query?search_query=au:%22kumar%22&max_results=1' },
];

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface Row {
  name: string;
  url: string;
  status: string;
  detail: string;
  tone: 'ok' | 'warn' | 'fail';
}

async function probe(name: string, url: string): Promise<Row> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': CRAWLER_CONFIG.userAgent, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    });
    clearTimeout(timer);

    const body = (await res.text()).slice(0, 4000);
    const title = (/<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1] ?? '').trim();

    if (res.status === 403 || res.status === 401) {
      return {
        name,
        url,
        status: String(res.status),
        detail: 'refused automated access (proxy policy or the site itself)',
        tone: 'fail',
      };
    }
    if (res.status === 404) {
      return { name, url, status: '404', detail: 'reachable — no profile for the probe handle', tone: 'ok' };
    }
    if (res.status === 429) {
      return { name, url, status: '429', detail: 'reachable but rate-limiting right now', tone: 'warn' };
    }
    if (!res.ok) {
      return { name, url, status: String(res.status), detail: title || 'unexpected status', tone: 'warn' };
    }
    if (/client challenge|just a moment|attention required|access denied/i.test(title)) {
      return { name, url, status: '200', detail: `bot challenge ("${title}") — treated as unavailable`, tone: 'warn' };
    }
    return { name, url, status: '200', detail: `reachable${title ? ` — "${title.slice(0, 44)}"` : ''}`, tone: 'ok' };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      name,
      url,
      status: 'ERR',
      detail: aborted ? 'timed out after 9s' : `network error: ${err instanceof Error ? err.message : 'unknown'}`,
      tone: 'fail',
    };
  }
}

function paint(row: Row): string {
  const colour = row.tone === 'ok' ? GREEN : row.tone === 'warn' ? YELLOW : RED;
  const mark = row.tone === 'ok' ? '✓' : row.tone === 'warn' ? '!' : '✗';
  return `  ${colour}${mark}${RESET} ${row.name.padEnd(26)} ${DIM}${row.status.padEnd(4)}${RESET} ${row.detail}`;
}

async function main() {
  console.log(`\n  Source doctor — probing with handle "${PROBE_HANDLE}"\n`);

  console.log('  CORE ENDPOINTS');
  const coreRows = await Promise.all(CORE_ENDPOINTS.map((e) => probe(e.name, e.url)));
  coreRows.forEach((r) => console.log(paint(r)));

  console.log('\n  PROFILE SITES');
  const sites = PROFILE_SITES.filter((s) => s.enabled);
  const siteRows: Row[] = [];
  // Probe in small batches so we stay polite.
  for (let i = 0; i < sites.length; i += 5) {
    const batch = sites.slice(i, i + 5);
    const rows = await Promise.all(
      batch.map((s) => probe(s.name, s.url.replace('{}', encodeURIComponent(PROBE_HANDLE)))),
    );
    rows.forEach((r) => {
      siteRows.push(r);
      console.log(paint(r));
    });
  }

  console.log('\n  ROBOTS.TXT DECISIONS');
  const hosts = [...new Set(sites.map((s) => {
    try {
      return new URL(s.url.replace('{}', 'x')).origin;
    } catch {
      return '';
    }
  }).filter(Boolean))].slice(0, 12);

  for (const origin of hosts) {
    try {
      const decision = await isAllowedByRobots(new URL(`${origin}/${PROBE_HANDLE}`));
      const colour = decision.allowed ? GREEN : RED;
      const mark = decision.allowed ? '✓' : '✗';
      console.log(`  ${colour}${mark}${RESET} ${new URL(origin).hostname.padEnd(26)} ${DIM}${decision.reason}${RESET}`);
    } catch {
      console.log(`  ${RED}✗${RESET} ${origin} — could not evaluate`);
    }
  }

  const all = [...coreRows, ...siteRows];
  const ok = all.filter((r) => r.tone === 'ok').length;
  const warn = all.filter((r) => r.tone === 'warn').length;
  const fail = all.filter((r) => r.tone === 'fail').length;

  console.log(`\n  SUMMARY  ${GREEN}${ok} reachable${RESET} · ${YELLOW}${warn} degraded${RESET} · ${RED}${fail} blocked${RESET}\n`);

  if (ok < 3) {
    console.log(
      `  ${YELLOW}Most sources are unreachable from this network.${RESET}\n` +
        '  That usually means a proxy, VPN or firewall is blocking outbound HTTPS —\n' +
        '  not a bug in the crawler. Try a different network, or present with\n' +
        '  Demo Data Mode, which needs no internet access at all.\n',
    );
  } else {
    console.log(
      `  ${DIM}Sites marked blocked or degraded are reported honestly in the UI as\n` +
        `  "Source unavailable for automated retrieval" — never silently dropped.${RESET}\n`,
    );
  }
}

main().catch((err) => {
  console.error('doctor failed:', err);
  process.exit(1);
});
