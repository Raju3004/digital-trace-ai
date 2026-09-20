import type {
  EvidenceSnippet,
  NormalizedRecord,
  Provenance,
  Reliability,
  SourceAttempt,
  SourceType,
  FetchOutcome,
} from '../types/index.js';
import { nowIso, shortId } from '../utils/ids.js';
import { uniq } from '../utils/text.js';

export interface CrawlResult {
  records: NormalizedRecord[];
  attempts: SourceAttempt[];
}

export interface CrawlInput {
  names: string[];
  usernames: string[];
  organizations: string[];
  events: string[];
  keywords: string[];
  locations: string[];
}

export function emptyResult(): CrawlResult {
  return { records: [], attempts: [] };
}

export function attemptFrom(source: string, outcome: FetchOutcome): SourceAttempt {
  return {
    url: outcome.url,
    source,
    ok: outcome.ok,
    reason: outcome.ok ? undefined : outcome.reason ?? 'Source unavailable for automated retrieval.',
    blockedBy: outcome.blockedBy,
    elapsedMs: outcome.elapsedMs,
    at: nowIso(),
  };
}

export function buildRecord(partial: {
  source: string;
  sourceType: SourceType;
  url: string;
  title: string;
  person?: string | null;
  usernames?: string[];
  organizations?: string[];
  roles?: string[];
  projects?: string[];
  events?: string[];
  publications?: string[];
  locations?: string[];
  dates?: string[];
  links?: string[];
  avatarUrl?: string | null;
  avatarHash?: string | null;
  bio?: string | null;
  rawEvidence?: EvidenceSnippet[];
  provenance: Provenance;
  reliability: Reliability;
}): NormalizedRecord {
  return {
    id: shortId('rec'),
    source: partial.source,
    sourceType: partial.sourceType,
    url: partial.url,
    title: partial.title,
    person: partial.person ?? null,
    usernames: uniq(partial.usernames ?? []).filter(Boolean),
    organizations: uniq(partial.organizations ?? []).filter(Boolean),
    roles: uniq(partial.roles ?? []).filter(Boolean),
    projects: uniq(partial.projects ?? []).filter(Boolean),
    events: uniq(partial.events ?? []).filter(Boolean),
    publications: uniq(partial.publications ?? []).filter(Boolean),
    locations: uniq(partial.locations ?? []).filter(Boolean),
    dates: uniq(partial.dates ?? []).filter(Boolean),
    links: uniq(partial.links ?? []).filter(Boolean),
    avatarUrl: partial.avatarUrl ?? null,
    avatarHash: partial.avatarHash ?? null,
    bio: partial.bio ?? null,
    rawEvidence: partial.rawEvidence ?? [],
    provenance: partial.provenance,
    discoveredAt: nowIso(),
    reliability: partial.reliability,
  };
}

/** Candidate handle permutations derived from a display name. */
export function handlePermutations(name: string, extra: string[] = []): string[] {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>(extra.map((e) => e.toLowerCase()).filter(Boolean));
  if (parts.length === 1) {
    out.add(parts[0]);
  } else if (parts.length >= 2) {
    const [first, last] = [parts[0], parts[parts.length - 1]];
    out.add(`${first}${last}`);
    out.add(`${first}.${last}`);
    out.add(`${first}_${last}`);
    out.add(`${first}-${last}`);
    out.add(`${first[0]}${last}`);
    out.add(`${first}${last[0]}`);
    out.add(first);
  }
  return [...out].filter((h) => h.length >= 3 && h.length <= 39);
}
