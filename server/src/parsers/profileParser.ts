import * as cheerio from 'cheerio';
import type { EvidenceSnippet } from '../types/index.js';
import { uniq } from '../utils/text.js';

export interface ParsedProfile {
  person: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  locations: string[];
  organizations: string[];
  links: string[];
  evidence: EvidenceSnippet[];
}

function text($: cheerio.CheerioAPI, selector: string): string | null {
  const v = $(selector).first().text().trim();
  return v || null;
}

function meta($: cheerio.CheerioAPI, name: string): string | null {
  const v =
    $(`meta[property="${name}"]`).attr('content') ?? $(`meta[name="${name}"]`).attr('content');
  return v?.trim() || null;
}

/**
 * Generic public-profile parser. Reads Open Graph / schema.org markup first
 * (stable across sites) and falls back to common profile selectors.
 */
export function parseProfile(html: string, pageUrl: string): ParsedProfile {
  const $ = cheerio.load(html);
  const evidence: EvidenceSnippet[] = [];

  const ogTitle = meta($, 'og:title');
  const ogDesc = meta($, 'og:description');
  const ogImage = meta($, 'og:image');

  const person =
    text($, '[itemprop="name"]') ??
    text($, '.p-name') ??
    text($, 'h1.vcard-names .p-name') ??
    (ogTitle ? ogTitle.split(/[(·|-]/)[0].trim() : null) ??
    text($, 'h1');

  const username =
    text($, '.p-nickname') ??
    text($, '[itemprop="additionalName"]') ??
    (() => {
      try {
        const segs = new URL(pageUrl).pathname.split('/').filter(Boolean);
        return segs[0] ?? null;
      } catch {
        return null;
      }
    })();

  const bio = text($, '.p-note') ?? text($, '[data-bio]') ?? ogDesc;

  const avatarUrl =
    $('img.avatar-user').attr('src') ??
    $('[itemprop="image"]').attr('src') ??
    ogImage ??
    null;

  const locations = uniq(
    [text($, '.p-label'), text($, '[itemprop="homeLocation"]'), text($, '[data-location]')].filter(
      (v): v is string => Boolean(v),
    ),
  );

  const organizations = uniq(
    $('[itemprop="worksFor"], .p-org, [data-org]')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean),
  );

  const links = uniq(
    $('a[rel="nofollow me"], .vcard-detail a[href^="http"], [itemprop="url"] a, a.Link--primary[href^="http"]')
      .map((_, el) => $(el).attr('href') ?? '')
      .get()
      .filter((h) => h.startsWith('http')),
  ).slice(0, 12);

  if (person) evidence.push({ label: 'Display name', excerpt: person });
  if (username) evidence.push({ label: 'Handle', excerpt: username });
  if (bio) evidence.push({ label: 'Public bio', excerpt: bio.slice(0, 240) });
  if (organizations.length)
    evidence.push({ label: 'Organization reference', excerpt: organizations.join(', ') });
  if (locations.length) evidence.push({ label: 'Stated location', excerpt: locations.join(', ') });

  return { person, username, bio, avatarUrl, locations, organizations, links, evidence };
}
