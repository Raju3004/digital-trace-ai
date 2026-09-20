import * as cheerio from 'cheerio';
import type { EvidenceSnippet } from '../types/index.js';
import { normalize, uniq } from '../utils/text.js';

export interface ParsedTeamMember {
  name: string;
  role: string | null;
  bio: string | null;
  links: string[];
  location: string | null;
}

export interface ParsedOrganization {
  organization: string | null;
  members: ParsedTeamMember[];
  projects: string[];
  evidence: EvidenceSnippet[];
}

/** Public team / about / people page parser for permitted organization domains. */
export function parseOrganization(
  html: string,
  pageUrl: string,
  targetName?: string,
): ParsedOrganization {
  const $ = cheerio.load(html);
  const evidence: EvidenceSnippet[] = [];

  const organization =
    $('meta[property="og:site_name"]').attr('content')?.trim() ||
    $('[itemprop="legalName"], [itemprop="name"]').first().text().trim() ||
    $('title').text().split(/[|\-–]/)[0].trim() ||
    null;

  const members: ParsedTeamMember[] = [];

  $('.team-member, .person, .member, [itemprop="employee"], li, article, .card').each((_, el) => {
    const node = $(el);
    const raw = node.text().replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 600) return;

    const name =
      node.find('[itemprop="name"], h3, h4, .name, strong').first().text().trim() || null;
    if (!name || name.split(/\s+/).length > 6 || name.length > 70) return;

    if (targetName) {
      const first = normalize(targetName).split(' ')[0];
      const last = normalize(targetName).split(' ').slice(-1)[0];
      const n = normalize(name);
      if (!n.includes(first) && !n.includes(last)) return;
    }

    const role =
      node.find('[itemprop="jobTitle"], .role, .title, .position, em').first().text().trim() || null;
    const bio = node.find('p').first().text().trim() || null;
    const location = node.find('[itemprop="address"], .location').first().text().trim() || null;
    const links = uniq(
      node
        .find('a[href^="http"]')
        .map((__, a) => $(a).attr('href') ?? '')
        .get()
        .filter(Boolean),
    ).slice(0, 6);

    members.push({ name, role, bio, links, location });
    if (evidence.length < 6) {
      evidence.push({ label: `Team page entry — ${name}`, excerpt: raw.slice(0, 260) });
    }
  });

  const projects = uniq(
    $('[data-project], .project h3, .projects li')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((v) => v && v.length < 90),
  ).slice(0, 12);

  const seen = new Set<string>();
  const dedupedMembers = members.filter((m) => {
    const key = m.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { organization, members: dedupedMembers.slice(0, 30), projects, evidence };
}
