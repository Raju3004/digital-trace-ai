import type {
  Candidate,
  Conflict,
  EvidenceItem,
  EvidenceStatus,
  NormalizedRecord,
  Reliability,
  SourceAttempt,
} from '../types/index.js';
import { shortId } from '../utils/ids.js';
import { clamp01, uniq } from '../utils/text.js';

/** Prototype source-reliability classification (not a universal standard). */
const RELIABILITY_BASE: Record<Reliability, number> = {
  High: 0.92,
  'Medium-High': 0.8,
  Medium: 0.66,
  'Low-Medium': 0.48,
  Low: 0.3,
};

export const SOURCE_RELIABILITY_TABLE = [
  { sourceType: 'official_organization', label: 'Official Organization', reliability: 'High' },
  { sourceType: 'public_profile', label: 'Professional / Public Profile', reliability: 'High' },
  { sourceType: 'public_repository', label: 'Public Repository', reliability: 'High' },
  { sourceType: 'publication', label: 'Publication Index', reliability: 'High' },
  { sourceType: 'event_listing', label: 'Event Listing', reliability: 'Medium-High' },
  { sourceType: 'personal_website', label: 'Personal Website (self-published)', reliability: 'Medium' },
  { sourceType: 'search_discovery', label: 'Search Discovery', reliability: 'Low-Medium' },
] as const;

/**
 * EVIDENCE VERIFICATION
 *
 * Turns each extracted claim into a finding carrying its source, the exact
 * supporting excerpt, provenance, a prototype confidence and a status.
 * A claim asserted by a single self-published source is never "Verified".
 */
export function verifyEvidence(
  records: NormalizedRecord[],
  candidates: Candidate[],
  attempts: SourceAttempt[],
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const top = candidates[0];
  const topRecordIds = new Set(top?.recordIds ?? []);
  const relevant = records.filter((r) => topRecordIds.has(r.id));

  const claimIndex = new Map<string, NormalizedRecord[]>();
  const addClaim = (claim: string, rec: NormalizedRecord) => {
    const list = claimIndex.get(claim) ?? [];
    list.push(rec);
    claimIndex.set(claim, list);
  };

  for (const rec of relevant) {
    const who = rec.person ?? top?.name ?? 'Subject';
    for (const org of rec.organizations) addClaim(`${who} is associated with ${org}.`, rec);
    for (const role of rec.roles) addClaim(`${who} holds the public role "${role}".`, rec);
    for (const ev of rec.events) addClaim(`${who} appears in the listing for ${ev}.`, rec);
    for (const pr of rec.projects) addClaim(`${who} is publicly associated with project "${pr}".`, rec);
    for (const pub of rec.publications) addClaim(`${who} is listed as an author of "${pub}".`, rec);
    for (const un of rec.usernames) addClaim(`The public handle "${un}" is associated with ${who}.`, rec);
    for (const loc of rec.locations) addClaim(`${who} is publicly associated with ${loc}.`, rec);
  }

  for (const [finding, sources] of claimIndex) {
    const primary = sources[0];
    const corroborated = uniq(sources.map((s) => s.source)).length > 1;
    const selfPublishedOnly = sources.every((s) => s.sourceType === 'personal_website');

    let status: EvidenceStatus;
    if (corroborated && !selfPublishedOnly) status = 'Verified';
    else if (selfPublishedOnly) status = 'Uncertain';
    else status = 'Supported';

    const base = RELIABILITY_BASE[primary.reliability];
    const confidence = clamp01(base * (corroborated ? 1 : 0.86) * (selfPublishedOnly ? 0.75 : 1));

    const excerpt =
      primary.rawEvidence.find((e) =>
        finding.toLowerCase().includes(e.excerpt.toLowerCase().slice(0, 12)),
      )?.excerpt ?? primary.rawEvidence[0]?.excerpt;

    items.push({
      id: shortId('ev'),
      finding,
      source: uniq(sources.map((s) => s.source)).join(' + '),
      sourceType: primary.sourceType,
      url: primary.url,
      supportingEvidence:
        primary.rawEvidence[0]?.label ??
        `${primary.sourceType.replace(/_/g, ' ')} content on ${primary.source}`,
      excerpt,
      provenance: primary.provenance,
      reliability: primary.reliability,
      confidence,
      status,
      discoveredAt: primary.discoveredAt,
    });
  }

  // Every failed retrieval is surfaced as an "Unavailable" finding — the system
  // never quietly hides a source it could not reach.
  for (const failed of attempts.filter((a) => !a.ok).slice(0, 12)) {
    items.push({
      id: shortId('ev'),
      finding: `Source unavailable for automated retrieval: ${failed.url}`,
      source: failed.source,
      sourceType: 'search_discovery',
      url: failed.url,
      supportingEvidence: failed.reason ?? 'No response.',
      provenance: 'PUBLIC_SOURCE',
      reliability: 'Low',
      confidence: null,
      status: 'Unavailable',
      discoveredAt: failed.at,
    });
  }

  items.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
  return items;
}

/**
 * CONFLICT DETECTION
 *
 * Conflicting information is preserved and reported — never silently dropped
 * in favour of whichever source was read first.
 */
export function detectConflicts(
  records: NormalizedRecord[],
  candidates: Candidate[],
): Conflict[] {
  const conflicts: Conflict[] = [];
  const top = candidates[0];
  if (!top) return conflicts;

  const cluster = records.filter((r) => top.recordIds.includes(r.id));

  // Location disagreement between two different sources.
  const locEntries = cluster
    .filter((r) => r.locations.length)
    .map((r) => ({ rec: r, city: r.locations[0].split(',')[0].trim() }));
  for (let i = 0; i < locEntries.length; i++) {
    for (let j = i + 1; j < locEntries.length; j++) {
      const a = locEntries[i];
      const b = locEntries[j];
      if (a.city.toLowerCase() === b.city.toLowerCase()) continue;
      if (conflicts.some((c) => c.field === 'location')) continue;
      conflicts.push({
        id: shortId('conf'),
        field: 'location',
        title: 'Location mismatch',
        sourceA: { source: a.rec.source, url: a.rec.url, value: a.city, provenance: a.rec.provenance },
        sourceB: { source: b.rec.source, url: b.rec.url, value: b.city, provenance: b.rec.provenance },
        status: 'Unresolved',
        note: 'Two independent sources state different locations. Both are retained; neither is assumed correct.',
      });
    }
  }

  // Employment / start-date disagreement.
  const orgRec = cluster.find((r) => r.sourceType === 'official_organization' && r.dates.length);
  const siteRec = cluster.find((r) => r.sourceType === 'personal_website' && r.dates.length);
  if (orgRec && siteRec) {
    const a = /\d{4}/.exec(orgRec.dates[0])?.[0];
    const b = /\d{4}/.exec(siteRec.dates[0])?.[0];
    if (a && b && a !== b) {
      conflicts.push({
        id: shortId('conf'),
        field: 'employment_date',
        title: 'Employment date mismatch',
        sourceA: { source: orgRec.source, url: orgRec.url, value: a, provenance: orgRec.provenance },
        sourceB: { source: siteRec.source, url: siteRec.url, value: b, provenance: siteRec.provenance },
        status: 'Requires verification',
        note: 'The organization page and the self-published profile state different start years.',
      });
    }
  }

  return conflicts;
}
