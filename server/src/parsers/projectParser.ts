import * as cheerio from 'cheerio';
import type { EvidenceSnippet } from '../types/index.js';
import { uniq } from '../utils/text.js';

export interface ParsedProject {
  name: string;
  description: string | null;
  language: string | null;
  url: string | null;
}

export interface ParsedProjects {
  projects: ParsedProject[];
  evidence: EvidenceSnippet[];
}

/** Extracts project / repository listings from a public page. */
export function parseProjects(html: string, pageUrl: string): ParsedProjects {
  const $ = cheerio.load(html);
  const projects: ParsedProject[] = [];

  // Repository-style listings.
  $('li[itemprop="owns"], .repo-list li, [data-project], article.project').each((_, el) => {
    const node = $(el);
    const name =
      node.find('[itemprop="name"], a[href]').first().text().trim() ||
      node.find('h3, h4').first().text().trim();
    if (!name) return;
    const description =
      node.find('[itemprop="description"], p').first().text().trim() || null;
    const language = node.find('[itemprop="programmingLanguage"]').first().text().trim() || null;
    const href = node.find('a[href]').first().attr('href') ?? null;
    let url: string | null = null;
    if (href) {
      try {
        url = new URL(href, pageUrl).toString();
      } catch {
        url = null;
      }
    }
    projects.push({ name, description, language, url });
  });

  // Fallback: generic headings inside a "projects" section.
  if (!projects.length) {
    $('section, div').each((_, el) => {
      const node = $(el);
      const heading = node.find('h1,h2,h3').first().text().trim().toLowerCase();
      if (!/project|work|portfolio|repositor/.test(heading)) return;
      node.find('li, article').each((__, item) => {
        const name = $(item).find('h3,h4,a,strong').first().text().trim();
        if (name && name.length < 90) {
          projects.push({
            name,
            description: $(item).find('p').first().text().trim() || null,
            language: null,
            url: null,
          });
        }
      });
    });
  }

  const deduped: ParsedProject[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }

  const evidence: EvidenceSnippet[] = deduped.slice(0, 6).map((p) => ({
    label: `Project listing — ${p.name}`,
    excerpt: p.description ?? p.name,
  }));

  return { projects: deduped.slice(0, 20), evidence };
}

export function projectNames(parsed: ParsedProjects): string[] {
  return uniq(parsed.projects.map((p) => p.name));
}
