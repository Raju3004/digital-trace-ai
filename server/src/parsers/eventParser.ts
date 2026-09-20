import * as cheerio from 'cheerio';
import type { EvidenceSnippet } from '../types/index.js';
import { normalize, uniq } from '../utils/text.js';

export interface ParsedEventParticipation {
  person: string | null;
  role: string | null;
  team: string | null;
  project: string | null;
  organization: string | null;
}

export interface ParsedEvent {
  eventName: string | null;
  dates: string[];
  participants: ParsedEventParticipation[];
  evidence: EvidenceSnippet[];
}

const ROLE_WORDS = ['participant', 'speaker', 'mentor', 'organizer', 'judge', 'finalist', 'winner'];

function detectRole(text: string): string | null {
  const t = normalize(text);
  for (const role of ROLE_WORDS) {
    if (t.includes(role)) return role[0].toUpperCase() + role.slice(1);
  }
  return null;
}

/** Extracts participant / speaker listings from a permitted public event page. */
export function parseEvent(html: string, targetName?: string): ParsedEvent {
  const $ = cheerio.load(html);
  const evidence: EvidenceSnippet[] = [];

  const eventName =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    null;

  const dates = uniq(
    [
      ...$('time[datetime]')
        .map((_, el) => $(el).attr('datetime') ?? '')
        .get(),
      ...$('[itemprop="startDate"], [itemprop="endDate"]')
        .map((_, el) => $(el).attr('content') ?? $(el).text())
        .get(),
    ]
      .map((d) => d.trim())
      .filter(Boolean),
  ).slice(0, 8);

  const participants: ParsedEventParticipation[] = [];
  const rowSelector =
    'li, tr, .participant, .speaker, .team-member, [data-participant], article';

  $(rowSelector).each((_, el) => {
    const node = $(el);
    const raw = node.text().replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 400) return;

    const person =
      node.find('[itemprop="name"], .name, strong, h3, h4, td:first-child').first().text().trim() ||
      null;
    if (!person || person.length > 80) return;

    if (targetName && !normalize(raw).includes(normalize(targetName).split(' ')[0])) {
      // keep the row only if it plausibly concerns the subject
      const surname = normalize(targetName).split(' ').slice(-1)[0];
      if (!surname || !normalize(raw).includes(surname)) return;
    }

    const role = detectRole(raw);
    const team =
      node.find('.team, [data-team]').first().text().trim() ||
      (/team[:\s]+([\w\s-]{2,40})/i.exec(raw)?.[1]?.trim() ?? null);
    const project =
      node.find('.project, [data-project]').first().text().trim() ||
      (/project[:\s]+([\w\s-]{2,60})/i.exec(raw)?.[1]?.trim() ?? null);
    const organization =
      node.find('.org, [data-org], [itemprop="affiliation"]').first().text().trim() || null;

    participants.push({ person, role, team, project, organization });
    if (evidence.length < 6) {
      evidence.push({ label: `Participant listing — ${person}`, excerpt: raw.slice(0, 240) });
    }
  });

  const seen = new Set<string>();
  const deduped = participants.filter((p) => {
    const key = `${p.person}|${p.role}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { eventName, dates, participants: deduped.slice(0, 40), evidence };
}
