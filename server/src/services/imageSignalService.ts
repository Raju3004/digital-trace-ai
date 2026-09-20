import { allowDiscoveredHost, fetchPublicImage } from '../crawlers/httpClient.js';
import type { NormalizedRecord } from '../types/index.js';

/**
 * PROTOTYPE IMAGE SIGNAL
 * ----------------------
 * What this does: compares the authorized photograph against the avatar
 * published on a profile the system ALREADY found by other means, using a
 * 64-bit average hash.
 *
 * What this is NOT: face recognition, and not an image search. It cannot take
 * a photograph of a stranger and find out who they are — it can only confirm
 * that a candidate found through handles and context publishes the same
 * picture. The photograph never leaves this process and is never sent to any
 * third party.
 *
 * Read the result correctly:
 *   - A match is strong positive evidence (the subject reused the image).
 *   - NO match is NOT evidence against the candidate. People use different
 *     photographs in different places, so a miss is reported as neutral and
 *     never lowers a candidate's score.
 */

/**
 * 16x16 grid → 256 bits.
 *
 * A 64-bit hash proved far too coarse to be trusted: measured on resized and
 * re-encoded copies of one photograph it scored distance 9, while a completely
 * unrelated image scored 13 — no usable separation. At 256 bits the same test
 * gives 0-3 for genuine reuse and 21+ for an unrelated image.
 */
const HASH_GRID = 16;
const HASH_BITS = HASH_GRID * HASH_GRID;
/** Hamming distance at or below this is treated as the same picture. */
const MATCH_THRESHOLD = 14;
/** Distance at or above this is treated as "clearly a different picture". */
export const CLEAR_MISS_THRESHOLD = 26;

export interface ImageComparison {
  recordId: string;
  source: string;
  avatarUrl: string;
  distance: number;
  similarity: number;
  verdict: 'match' | 'inconclusive' | 'different';
}

/**
 * Average hash: 16x16 greyscale, one bit per pixel against the mean.
 *
 * BOTH sides of every comparison are hashed by this function — the uploaded
 * photograph in the upload route, and each avatar here. An earlier version
 * hashed the upload in the browser with canvas and the avatar here with Jimp;
 * the two resamplers disagree enough that identical images differed as much as
 * unrelated ones did. Hashing both sides in one place removes that entirely.
 */
export async function averageHashFromBuffer(buffer: Buffer): Promise<string | null> {
  let Jimp: typeof import('jimp').Jimp;
  try {
    ({ Jimp } = await import('jimp'));
  } catch {
    // Image decoding is optional. Without it the signal reports unavailable
    // rather than failing the investigation.
    return null;
  }

  try {
    const image = await Jimp.read(buffer);
    image.resize({ w: HASH_GRID, h: HASH_GRID }).greyscale();

    const { data } = image.bitmap;
    const grays: number[] = [];
    for (let i = 0; i < data.length; i += 4) grays.push(data[i]);
    if (grays.length < HASH_BITS) return null;

    const mean = grays.reduce((a, b) => a + b, 0) / grays.length;

    let hex = '';
    for (let i = 0; i < HASH_BITS; i += 4) {
      let nibble = 0;
      for (let j = 0; j < 4; j++) if (grays[i + j] > mean) nibble |= 1 << (3 - j);
      hex += nibble.toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

/**
 * Some sites publish a malformed image URL in their Open Graph tags. GitHub,
 * for one, emits `.../u/12345?v=4?s=400` — a second "?" where an "&" belongs,
 * which makes the size parameter part of `v` and can fail outright. Repair the
 * query rather than discarding an otherwise good avatar.
 */
export function normalizeImageUrl(raw: string): string {
  const first = raw.indexOf('?');
  if (first === -1) return raw;
  return raw.slice(0, first + 1) + raw.slice(first + 1).replace(/\?/g, '&');
}

/** Retrieves a published avatar and hashes it. Returns null on any failure. */
export async function hashRemoteImage(url: string): Promise<string | null> {
  const outcome = await fetchPublicImage(normalizeImageUrl(url));
  if (!outcome.ok || !outcome.buffer) return null;
  return averageHashFromBuffer(outcome.buffer);
}

export function hammingDistance(a: string, b: string): number | null {
  if (!a || !b || a.length !== b.length) return null;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16);
    const y = parseInt(b[i], 16);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    let diff = x ^ y;
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

export function compareHashes(subjectHash: string, avatarHash: string): Omit<ImageComparison, 'recordId' | 'source' | 'avatarUrl'> | null {
  const distance = hammingDistance(subjectHash, avatarHash);
  if (distance === null) return null;

  const similarity = 1 - distance / HASH_BITS;
  const verdict: ImageComparison['verdict'] =
    distance <= MATCH_THRESHOLD
      ? 'match'
      : distance >= CLEAR_MISS_THRESHOLD
        ? 'different'
        : 'inconclusive';

  return { distance, similarity, verdict };
}

/**
 * Fetches and hashes the avatar of every record that publishes one, writing
 * the result onto the record so correlation can stay synchronous.
 */
export async function attachAvatarHashes(
  records: NormalizedRecord[],
  onProgress?: (message: string, level: 'info' | 'success' | 'warn') => void,
): Promise<number> {
  const withAvatars = records.filter((r) => r.avatarUrl && !r.avatarHash);
  if (!withAvatars.length) return 0;

  onProgress?.(`Hashing ${withAvatars.length} published avatar image(s) for comparison…`, 'info');

  let hashed = 0;
  await Promise.all(
    withAvatars.map(async (record) => {
      // Avatars are usually served from a separate CDN host that cannot be
      // known in advance — GitHub publishes its profile images on
      // avatars.githubusercontent.com, for instance. The image is an asset
      // referenced by a page we were already permitted to retrieve, so open
      // its host for this investigation only. robots.txt, the denied-host list
      // and the rate limiter still apply to the request itself.
      try {
        allowDiscoveredHost(new URL(record.avatarUrl!).hostname);
      } catch {
        return;
      }

      const hash = await hashRemoteImage(record.avatarUrl!);
      if (hash) {
        record.avatarHash = hash;
        hashed += 1;
      }
    }),
  );

  onProgress?.(
    hashed
      ? `${hashed} of ${withAvatars.length} avatar(s) retrieved and hashed.`
      : 'No avatar could be retrieved for comparison.',
    hashed ? 'success' : 'warn',
  );

  return hashed;
}

/** Best comparison across every record in a candidate's cluster. */
export function bestComparisonForCluster(
  subjectHash: string | undefined,
  cluster: NormalizedRecord[],
): ImageComparison | null {
  if (!subjectHash) return null;

  let best: ImageComparison | null = null;
  for (const record of cluster) {
    if (!record.avatarHash || !record.avatarUrl) continue;
    const cmp = compareHashes(subjectHash, record.avatarHash);
    if (!cmp) continue;
    if (!best || cmp.distance < best.distance) {
      best = {
        recordId: record.id,
        source: record.source,
        avatarUrl: record.avatarUrl,
        ...cmp,
      };
    }
  }
  return best;
}
