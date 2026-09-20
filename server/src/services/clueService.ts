import type { Clue, ImageSignal, KnownContext } from '../types/index.js';
import { shortId } from '../utils/ids.js';
import { handlePermutations } from '../crawlers/base.js';
import { normalize, uniq } from '../utils/text.js';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'about', 'into', 'over',
  'was', 'were', 'has', 'have', 'been', 'are', 'his', 'her', 'their', 'work',
  'working', 'worked', 'team', 'india', 'using',
]);

/**
 * INPUT & CLUE EXTRACTION
 *
 * Turns the authorized photograph + limited context into structured search
 * clues. The image is only ever used as a *prototype signal* — no face
 * recognition is performed and none is claimed.
 */
export function extractClues(context: KnownContext, image: ImageSignal): Clue[] {
  const clues: Clue[] = [];

  const push = (c: Omit<Clue, 'id'>) => clues.push({ id: shortId('clue'), ...c });

  if (context.fullName?.trim()) {
    push({
      type: 'name',
      value: context.fullName.trim(),
      origin: 'user_context',
      confidence: 0.9,
      note: 'Supplied as known context.',
    });
  }

  if (context.username?.trim()) {
    push({
      type: 'username',
      value: context.username.trim(),
      origin: 'user_context',
      confidence: 0.9,
      note: 'Supplied as known context.',
    });
  }

  // Derive plausible handle permutations from the name, clearly marked as derived.
  if (context.fullName?.trim()) {
    const derived = handlePermutations(context.fullName.trim(), [])
      .filter((h) => h !== normalize(context.username ?? ''))
      .slice(0, 4);
    for (const handle of derived) {
      push({
        type: 'username',
        value: handle,
        origin: 'derived_from_discovery',
        derivedFrom: context.fullName.trim(),
        confidence: 0.35,
        note: 'Generated handle permutation — unverified until a source confirms it.',
      });
    }
  }

  if (context.organization?.trim()) {
    push({
      type: 'organization',
      value: context.organization.trim(),
      origin: 'user_context',
      confidence: 0.85,
      note: 'Supplied as known context.',
    });
  }

  if (context.event?.trim()) {
    push({
      type: 'event',
      value: context.event.trim(),
      origin: 'user_context',
      confidence: 0.85,
      note: 'Supplied as known context.',
    });
  }

  if (context.location?.trim()) {
    push({
      type: 'location',
      value: context.location.trim(),
      origin: 'user_context',
      confidence: 0.7,
      note: 'Supplied as known context.',
    });
  }

  const keywords = extractKeywords(context.notes ?? '');
  for (const kw of keywords) {
    push({
      type: 'keyword',
      value: kw,
      origin: 'user_context',
      confidence: 0.5,
      note: 'Detected keyword from additional context.',
    });
  }

  if (image.provided) {
    push({
      type: 'image',
      value: image.aHash ? `aHash:${image.aHash}` : 'image supplied (no hash computed)',
      origin: 'image_signal',
      confidence: 0.2,
      note:
        'Prototype image signal. No face recognition is performed. The image is reduced to a perceptual hash and compared against avatars published by profiles found through handles and context — it verifies picture reuse, and cannot identify an unknown person.',
    });
  }

  return clues;
}

function extractKeywords(notes: string): string[] {
  if (!notes.trim()) return [];
  const words = normalize(notes)
    .split(/[\s,;/]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const phrases: string[] = [];
  const known = [
    'fraud detection',
    'machine learning',
    'artificial intelligence',
    'cyber security',
    'cybersecurity',
    'data science',
    'computer vision',
    'open source',
  ];
  const lower = normalize(notes);
  for (const p of known) if (lower.includes(p)) phrases.push(titleize(p));

  return uniq([...phrases, ...words.map(titleize)]).slice(0, 8);
}

function titleize(v: string): string {
  return v
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function cluesToCrawlInput(clues: Clue[]) {
  const by = (t: Clue['type']) => clues.filter((c) => c.type === t).map((c) => c.value);
  return {
    names: uniq(by('name')),
    usernames: uniq(by('username')),
    organizations: uniq(by('organization')),
    events: uniq(by('event')),
    keywords: uniq(by('keyword')),
    locations: uniq(by('location')),
  };
}
