/** String similarity helpers used by the correlation engine. No dependencies. */

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

/** Jaro similarity. */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler similarity in [0,1]. */
export function jaroWinkler(a: string, b: string): number {
  const s1 = normalize(a);
  const s2 = normalize(b);
  const base = jaro(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return base + prefix * 0.1 * (1 - base);
}

export function levenshtein(a: string, b: string): number {
  const s1 = normalize(a);
  const s2 = normalize(b);
  const m = s1.length;
  const n = s2.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Token-set ratio: robust to reordering and to shortened forms such as
 * "Rahul Kumar" vs "Rahul K." vs "Kumar, Rahul".
 */
export function tokenSetRatio(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  const intersection = [...setA].filter((t) => setB.has(t));

  // Also treat single-letter tokens as initials: "k" matches "kumar".
  let initialBonus = 0;
  for (const t of setA) {
    if (t.length === 1) {
      if ([...setB].some((u) => u.startsWith(t))) initialBonus += 1;
    }
  }
  for (const t of setB) {
    if (t.length === 1) {
      if ([...setA].some((u) => u.startsWith(t))) initialBonus += 1;
    }
  }

  const overlap = intersection.length + initialBonus * 0.8;
  return Math.min(1, (2 * overlap) / (setA.size + setB.size));
}

/** Combined name similarity, blending Jaro-Winkler with token-set overlap. */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const jw = jaroWinkler(a, b);
  const ts = tokenSetRatio(a, b);
  return Math.max(ts, 0.45 * jw + 0.55 * ts);
}

/** Username similarity: handles rahul_dev / rahultech / rahul-dev style variants. */
export function usernameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ca = clean(a);
  const cb = clean(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) return 0.88;

  // Shared alphabetic stem, e.g. "rahul" in rahul_dev and rahultech.
  const stem = longestCommonPrefix(ca, cb);
  const stemScore = stem.length >= 4 ? 0.55 + Math.min(0.3, (stem.length - 4) * 0.05) : 0;

  const dist = levenshtein(ca, cb);
  const editScore = 1 - dist / Math.max(ca.length, cb.length);

  return Math.max(stemScore, editScore);
}

function longestCommonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

/** Organization similarity ignoring legal suffixes. */
export function orgSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const strip = (v: string) =>
    normalize(v).replace(/\b(inc|llc|ltd|limited|pvt|private|corp|corporation|technologies|technology|labs|systems|solutions)\b/g, '').trim();
  const sa = strip(a);
  const sb = strip(b);
  if (sa && sa === sb) return 1;
  return Math.max(nameSimilarity(a, b), nameSimilarity(sa || a, sb || b));
}

export function bestMatch(value: string, pool: string[], fn = nameSimilarity): { value: string; score: number } {
  let best = { value: '', score: 0 };
  for (const p of pool) {
    const s = fn(value, p);
    if (s > best.score) best = { value: p, score: s };
  }
  return best;
}

export function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function pct(n: number | null): number | null {
  return n === null ? null : Math.round(clamp01(n) * 100);
}
