import * as cheerio from 'cheerio';
import { fetchPublicPage } from './httpClient.js';
import { attemptFrom, buildRecord, emptyResult, type CrawlInput, type CrawlResult } from './base.js';
import { nameSimilarity, uniq } from '../utils/text.js';

/**
 * Publication crawler.
 *
 * Uses arXiv's documented public export interface, which explicitly permits
 * automated access and requires no key. Never invents bibliographic data:
 * every field comes from the returned Atom feed.
 */
export async function crawlPublications(input: CrawlInput, maxAuthors = 2): Promise<CrawlResult> {
  const result = emptyResult();
  const authors = input.names.slice(0, maxAuthors);

  for (const author of authors) {
    const query = `au:"${author}"`;
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=8`;
    const outcome = await fetchPublicPage(url, { accept: 'application/atom+xml' });
    result.attempts.push(attemptFrom('arXiv Export API', outcome));
    if (!outcome.ok || !outcome.html) continue;

    const $ = cheerio.load(outcome.html, { xmlMode: true });
    $('entry').each((_, el) => {
      const entry = $(el);
      const title = entry.find('title').first().text().replace(/\s+/g, ' ').trim();
      if (!title) return;
      const authorNames = entry
        .find('author > name')
        .map((__, a) => $(a).text().trim())
        .get();
      const matchesAuthor = authorNames.some((n) => nameSimilarity(n, author) >= 0.82);
      if (!matchesAuthor) return;

      const link = entry.find('id').first().text().trim();
      const published = entry.find('published').first().text().trim();
      const summary = entry.find('summary').first().text().replace(/\s+/g, ' ').trim();
      const affiliations = uniq(
        entry
          .find('arxiv\\:affiliation, affiliation')
          .map((__, a) => $(a).text().trim())
          .get()
          .filter(Boolean),
      );

      result.records.push(
        buildRecord({
          source: 'arXiv',
          sourceType: 'publication',
          url: link,
          title: `Publication — ${title}`,
          person: authorNames.find((n) => nameSimilarity(n, author) >= 0.82) ?? author,
          organizations: affiliations,
          publications: [title],
          dates: published ? [published] : [],
          links: [link],
          rawEvidence: [
            { label: 'Publication title', excerpt: title },
            { label: 'Author list', excerpt: authorNames.join(', ') },
            ...(summary ? [{ label: 'Abstract excerpt', excerpt: summary.slice(0, 280) }] : []),
          ],
          provenance: 'PUBLIC_SOURCE',
          reliability: 'High',
        }),
      );
    });
  }

  return result;
}
