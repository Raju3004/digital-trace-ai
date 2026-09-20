import type { Candidate, NormalizedRecord, TimelineEntry } from '../types/index.js';
import { shortId } from '../utils/ids.js';

/**
 * TIMELINE
 *
 * Only dates that actually appear in a retrieved source are used. When a
 * source states a year alone, the entry is marked `precision: 'year'` and no
 * exact day is invented.
 */
export function buildTimeline(
  records: NormalizedRecord[],
  candidates: Candidate[],
): TimelineEntry[] {
  const top = candidates[0];
  if (!top) return [];

  const cluster = records.filter((r) => top.recordIds.includes(r.id));
  const entries: TimelineEntry[] = [];

  for (const rec of cluster) {
    for (const rawDate of rec.dates) {
      const parsed = parseDate(rawDate);
      if (!parsed) continue;

      entries.push({
        id: shortId('tl'),
        date: parsed.value,
        precision: parsed.precision,
        activity: describe(rec),
        organization: rec.organizations[0] ?? null,
        source: rec.source,
        url: rec.url,
        evidence: rec.rawEvidence[0]?.excerpt ?? rec.title,
        confidence: reliabilityToConfidence(rec.reliability),
        provenance: rec.provenance,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = entries.filter((e) => {
    const key = `${e.date}|${e.activity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => a.date.localeCompare(b.date));
  return deduped;
}

function describe(rec: NormalizedRecord): string {
  if (rec.events.length) {
    const role = rec.roles[0] ? `${rec.roles[0]} — ` : '';
    return `${role}${rec.events[0]}`;
  }
  if (rec.publications.length) return `Publication: ${rec.publications[0]}`;
  if (rec.sourceType === 'official_organization' && rec.roles.length) {
    return `${rec.roles[0]} at ${rec.organizations[0] ?? rec.source}`;
  }
  if (rec.sourceType === 'public_repository') return `Repository activity: ${rec.projects[0] ?? rec.title}`;
  if (rec.sourceType === 'public_profile') return `Public profile created on ${rec.source}`;
  return rec.title;
}

function parseDate(raw: string): { value: string; precision: 'year' | 'month' | 'day' } | null {
  const trimmed = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return { value: `${iso[1]}-${iso[2]}-${iso[3]}`, precision: 'day' };
  const ym = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (ym) return { value: `${ym[1]}-${ym[2]}`, precision: 'month' };
  const y = /^(\d{4})$/.exec(trimmed) ?? /\b(19|20)(\d{2})\b/.exec(trimmed);
  if (y) {
    const year = y[0].length === 4 ? y[0] : `${y[1]}${y[2]}`;
    return { value: year, precision: 'year' };
  }
  return null;
}

function reliabilityToConfidence(r: NormalizedRecord['reliability']): number {
  switch (r) {
    case 'High':
      return 0.92;
    case 'Medium-High':
      return 0.8;
    case 'Medium':
      return 0.66;
    case 'Low-Medium':
      return 0.48;
    default:
      return 0.3;
  }
}
