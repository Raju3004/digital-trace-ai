import type {
  Candidate,
  Clue,
  CorrelationSignal,
  ImageSignal,
  NormalizedRecord,
} from '../types/index.js';
import { cluesToCrawlInput } from './clueService.js';
import { bestComparisonForCluster, CLEAR_MISS_THRESHOLD } from './imageSignalService.js';
import { shortId } from '../utils/ids.js';
import {
  bestMatch,
  clamp01,
  nameSimilarity,
  normalize,
  orgSimilarity,
  uniq,
  usernameSimilarity,
} from '../utils/text.js';

/**
 * IDENTITY CORRELATION / ENTITY RESOLUTION
 *
 * Two stages:
 *   1. Cluster raw records into distinct real-world candidates, using shared
 *      handles, reciprocal links and name+attribute agreement — never name alone.
 *   2. Score each cluster against the authorized input clues across many
 *      independent signals.
 *
 * The output is explicitly a PROTOTYPE CORRELATION SCORE, not a calibrated
 * probability. Weights are hand-set and renormalized over the signals that
 * were actually available, so an unavailable signal neither helps nor hurts.
 */

/**
 * Score assigned when a candidate's avatar is a CLEAR miss against the
 * supplied photograph. Deliberately low (not 0) rather than excluding the
 * signal: it should pull a weighted average down, not just fail to help.
 */
const IMAGE_MISMATCH_SCORE = 0.05;

const WEIGHTS: Record<CorrelationSignal['key'], number> = {
  name: 0.15,
  username: 0.18,
  organization: 0.16,
  role: 0.04,
  location: 0.06,
  project: 0.12,
  event: 0.12,
  publication: 0.05,
  website: 0.04,
  cross_profile_link: 0.1,
  image_signal: 0.08,
};

const LABELS: Record<CorrelationSignal['key'], string> = {
  name: 'Name Match',
  username: 'Username Match',
  organization: 'Organization Match',
  role: 'Role Match',
  location: 'Location Match',
  project: 'Project Match',
  event: 'Event Match',
  publication: 'Publication Match',
  website: 'Website Match',
  cross_profile_link: 'Cross-profile Links',
  image_signal: 'Image Signal',
};

// ---------------------------------------------------------------- clustering

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = this.parent.get(x)!;
    if (root !== x) {
      root = this.find(root);
      this.parent.set(x, root);
    }
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase();
  }
}
/**
 * The city (first comma-separated segment) of a "City, State/Country" string.
 * Comparing full location strings let "Hyderabad, India" and "Bengaluru,
 * India" score as partially matching purely because they share "India" — two
 * completely different cities. Comparing the city alone removes that.
 */
function cityOnly(location: string): string {
  return location.split(',')[0].trim();
}

function sharesStrongAttribute(a: NormalizedRecord, b: NormalizedRecord): boolean {
  const overlap = (x: string[], y: string[], fn = normalize) =>
    x.some((i) => y.some((j) => fn(i) === fn(j)));
  return (
    overlap(a.organizations, b.organizations) ||
    overlap(a.projects, b.projects) ||
    overlap(a.events, b.events) ||
    overlap(a.publications, b.publications)
  );
}

/** Groups records that plausibly describe the same real-world person. */
export function clusterRecords(records: NormalizedRecord[]): NormalizedRecord[][] {
  const uf = new UnionFind();
  for (const r of records) uf.find(r.id);

  const byUrl = new Map<string, NormalizedRecord>();
  for (const r of records) byUrl.set(urlKey(r.url), r);

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];

      // Signal 1: a shared public handle.
      const handleOverlap = a.usernames.some((u) =>
        b.usernames.some((v) => usernameSimilarity(u, v) >= 0.95),
      );

      // Signal 2: a RECIPROCAL link — each page must reference the other.
      // A one-way link is common and weak (an aggregator, a "featured on" page,
      // or a mutual-mention page linking out proves nothing about identity on
      // its own), and treating it as sufficient on its own was merging distinct
      // people who simply appeared near each other on a crawled page. Requiring
      // both directions turns this into real corroborating evidence.
      const linkOverlap =
        a.links.some((l) => urlKey(l) === urlKey(b.url)) &&
        b.links.some((l) => urlKey(l) === urlKey(a.url));

      // Signal 3: strong name agreement PLUS at least one shared attribute.
      const nameAgreement =
        a.person && b.person ? nameSimilarity(a.person, b.person) >= 0.8 : false;
      const nameAndAttribute = nameAgreement && sharesStrongAttribute(a, b);

      if (handleOverlap || linkOverlap || nameAndAttribute) uf.union(a.id, b.id);
    }
  }

  const groups = new Map<string, NormalizedRecord[]>();
  for (const r of records) {
    const root = uf.find(r.id);
    const list = groups.get(root) ?? [];
    list.push(r);
    groups.set(root, list);
  }
  return [...groups.values()];
}

// ------------------------------------------------------------------ scoring

function pickSignal(
  key: CorrelationSignal['key'],
  score: number | null,
  detail: string,
  status: CorrelationSignal['status'],
): CorrelationSignal {
  return { key, label: LABELS[key], score, weight: WEIGHTS[key], detail, status };
}

function aggregate(cluster: NormalizedRecord[]) {
  return {
    names: uniq(cluster.map((r) => r.person).filter((v): v is string => Boolean(v))),
    usernames: uniq(cluster.flatMap((r) => r.usernames)),
    organizations: uniq(cluster.flatMap((r) => r.organizations)),
    roles: uniq(cluster.flatMap((r) => r.roles)),
    locations: uniq(cluster.flatMap((r) => r.locations)),
    projects: uniq(cluster.flatMap((r) => r.projects)),
    events: uniq(cluster.flatMap((r) => r.events)),
    publications: uniq(cluster.flatMap((r) => r.publications)),
    links: uniq(cluster.flatMap((r) => r.links)),
    dates: uniq(cluster.flatMap((r) => r.dates)),
  };
}

export interface CorrelationInput {
  clues: Clue[];
  image: ImageSignal;
}

export function correlateCandidates(
  records: NormalizedRecord[],
  input: CorrelationInput,
): Candidate[] {
  // Scoring compares candidates against what was AUTHORIZED, not against
  // clues the system itself derived from a candidate's own records during
  // iterative discovery — otherwise a candidate's cluster would trivially
  // "match" a fact that was only ever found there in the first place. Derived
  // username permutations are the one exception that predates this: they are
  // already explicitly discounted below rather than excluded outright.
  const scoringClues = input.clues.filter(
    (c) => c.origin !== 'derived_from_discovery' || c.type === 'username',
  );
  const wanted = cluesToCrawlInput(scoringClues);
  const clusters = clusterRecords(records);
  const candidates: Candidate[] = [];

  for (const cluster of clusters) {
    const agg = aggregate(cluster);
    const signals: CorrelationSignal[] = [];
    const conflicts: string[] = [];

    // --- name
    if (wanted.names.length && agg.names.length) {
      const best = bestMatch(wanted.names[0], agg.names, nameSimilarity);
      signals.push(
        pickSignal(
          'name',
          best.score,
          `"${wanted.names[0]}" vs "${best.value}"`,
          best.score >= 0.85 ? 'match' : best.score >= 0.6 ? 'partial' : 'conflict',
        ),
      );
    } else {
      signals.push(pickSignal('name', null, 'No name supplied or none published.', 'unavailable'));
    }

    // --- username
    //
    // A handle the operator actually supplied is far stronger evidence than a
    // permutation this system invented from their name. Matching a generated
    // handle only tells us the guess was plausible, so those matches are
    // discounted and labelled as derived.
    const usernameClues = input.clues.filter((c) => c.type === 'username');
    if (usernameClues.length && agg.usernames.length) {
      let best = { score: 0, detail: '', derived: false };
      for (const clue of usernameClues) {
        const derived = clue.origin === 'derived_from_discovery';
        const originFactor = derived ? 0.6 : 1;
        for (const c of agg.usernames) {
          const raw = usernameSimilarity(clue.value, c);
          const s = raw * originFactor;
          if (s > best.score) {
            best = {
              score: s,
              detail: derived
                ? `derived handle "${clue.value}" vs published "${c}" (generated guess — discounted)`
                : `supplied handle "${clue.value}" vs published "${c}"`,
              derived,
            };
          }
        }
      }
      signals.push(
        pickSignal(
          'username',
          best.score,
          best.detail || 'No comparable handle.',
          best.score >= 0.85 ? 'match' : best.score >= 0.55 ? 'partial' : 'conflict',
        ),
      );
    } else {
      signals.push(
        pickSignal('username', null, 'No handle supplied or none published.', 'unavailable'),
      );
    }

    // --- organization
    if (wanted.organizations.length && agg.organizations.length) {
      const best = bestMatch(wanted.organizations[0], agg.organizations, orgSimilarity);
      const status = best.score >= 0.85 ? 'match' : best.score >= 0.5 ? 'partial' : 'conflict';
      signals.push(
        pickSignal('organization', best.score, `"${wanted.organizations[0]}" vs "${best.value}"`, status),
      );
      if (status === 'conflict') {
        conflicts.push(
          `Stated organization "${wanted.organizations[0]}" does not match published "${best.value}".`,
        );
      }
    } else {
      signals.push(
        pickSignal('organization', null, 'No organization supplied or none published.', 'unavailable'),
      );
    }

    // --- role
    if (agg.roles.length) {
      signals.push(pickSignal('role', 0.6, `Published role: ${agg.roles.join(', ')}`, 'partial'));
    } else {
      signals.push(pickSignal('role', null, 'No public role statement found.', 'unavailable'));
    }

       // --- location
    if (wanted.locations.length && agg.locations.length) {
      const wantedCity = cityOnly(wanted.locations[0]);
      let best = { value: agg.locations[0], score: 0 };
      for (const loc of agg.locations) {
        const s = nameSimilarity(wantedCity, cityOnly(loc));
        if (s > best.score) best = { value: loc, score: s };
      }
      const status = best.score >= 0.75 ? 'match' : best.score >= 0.4 ? 'partial' : 'conflict';
      signals.push(
        pickSignal('location', best.score, `"${wanted.locations[0]}" vs "${best.value}"`, status),
      );
            if (status === 'conflict') {
        conflicts.push(
          `Stated location "${wanted.locations[0]}" does not match published "${best.value}".`,
        );
      }
    } else {
      signals.push(pickSignal('location', null, 'No location supplied or none published.', 'unavailable'));
    }

    // --- project
    const projectHit = overlapScore(
      [...wanted.keywords, ...wanted.organizations],
      agg.projects,
      wanted.names[0],
    );
    if (agg.projects.length) {
      signals.push(
        pickSignal(
          'project',
          projectHit.score,
          projectHit.detail || `Public projects: ${agg.projects.slice(0, 3).join(', ')}`,
          projectHit.score >= 0.7 ? 'match' : projectHit.score > 0 ? 'partial' : 'unavailable',
        ),
      );
    } else {
      signals.push(pickSignal('project', null, 'No public project references found.', 'unavailable'));
    }

    // --- event
    if (wanted.events.length && agg.events.length) {
      const best = bestMatch(wanted.events[0], agg.events, nameSimilarity);
      signals.push(
        pickSignal(
          'event',
          best.score,
          `"${wanted.events[0]}" vs "${best.value}"`,
          best.score >= 0.8 ? 'match' : best.score >= 0.5 ? 'partial' : 'conflict',
        ),
      );
    } else if (agg.events.length) {
      signals.push(
        pickSignal('event', 0.4, `Public events: ${agg.events.join(', ')}`, 'partial'),
      );
    } else {
      signals.push(pickSignal('event', null, 'No public event listing found.', 'unavailable'));
    }

    // --- publication
    if (agg.publications.length) {
      signals.push(
        pickSignal('publication', 0.8, `Publication(s): ${agg.publications[0]}`, 'match'),
      );
    } else {
      signals.push(pickSignal('publication', null, 'No public publication found.', 'unavailable'));
    }

    // --- website
    const personalSite = cluster.find((r) => r.sourceType === 'personal_website');
    if (personalSite) {
      signals.push(
        pickSignal('website', 0.75, `Personal site: ${personalSite.url}`, 'match'),
      );
    } else {
      signals.push(pickSignal('website', null, 'No personal website found.', 'unavailable'));
    }

    // --- cross-profile links
    const crossLinks = countCrossLinks(cluster);
    if (crossLinks.total > 0) {
      const score = clamp01(0.55 + crossLinks.total * 0.15);
      signals.push(
        pickSignal(
          'cross_profile_link',
          score,
          `${crossLinks.total} reciprocal link(s): ${crossLinks.examples.slice(0, 2).join(' · ')}`,
          'match',
        ),
      );
    } else {
      signals.push(
        pickSignal(
          'cross_profile_link',
          null,
          'No page in this cluster links to another.',
          'unavailable',
        ),
      );
    }

    // --- image signal
    //
    // Compares the authorized photograph against avatars published by profiles
    // that were ALREADY found through handles and context. This verifies image
    // reuse; it is not face recognition and cannot identify an unknown person.
    //
    // A match counts strongly in favour. An INCONCLUSIVE distance (the hash
    // couldn't tell either way) still counts for nothing — people routinely use
    // different pictures on different sites, so ambiguity is not evidence of
    // anything. But a CLEAR miss (hash distance past CLEAR_MISS_THRESHOLD) is
    // now treated as real, if modest, evidence against this being the same
    // person, and is surfaced as a conflict — a candidate should not be able to
    // reach a confident score while publishing a demonstrably different photo.
    const avatar = cluster.find((r) => r.avatarUrl)?.avatarUrl ?? null;
    if (!input.image.provided) {
      signals.push(pickSignal('image_signal', null, 'No authorized image supplied.', 'unavailable'));
    } else if (!input.image.aHash) {
      signals.push(
        pickSignal(
          'image_signal',
          null,
          'The supplied image could not be decoded, so no comparison was possible.',
          'unavailable',
        ),
      );
    } else {
      const comparison = bestComparisonForCluster(input.image.aHash, cluster);
      if (!comparison) {
        signals.push(
          pickSignal(
            'image_signal',
            null,
            avatar
              ? `A public avatar exists (${avatar}) but could not be retrieved or decoded for comparison.`
              : 'No public avatar was published by this candidate, so there is nothing to compare against.',
            'unavailable',
          ),
        );
      } else if (comparison.verdict === 'match') {
        signals.push(
          pickSignal(
            'image_signal',
            comparison.similarity,
            `The authorized photograph matches the avatar published on ${comparison.source} ` +
              `(perceptual hash distance ${comparison.distance}/256). This indicates the same picture is in use — ` +
              `it is not face recognition.`,
            'match',
          ),
        );
      } else if (comparison.verdict === 'different') {
        signals.push(
          pickSignal(
            'image_signal',
            IMAGE_MISMATCH_SCORE,
            `The avatar on ${comparison.source} is a clearly different picture ` +
              `(hash distance ${comparison.distance}/256, past the ${CLEAR_MISS_THRESHOLD} threshold). ` +
              `Counted as evidence against this being the same person, not as face recognition.`,
            'conflict',
          ),
        );
        conflicts.push(
          `Published avatar on ${comparison.source} does not match the supplied photograph ` +
            `(hash distance ${comparison.distance}/256).`,
        );
      } else {
        signals.push(
          pickSignal(
            'image_signal',
            null,
            `The avatar on ${comparison.source} is ambiguous next to the supplied photograph ` +
              `(hash distance ${comparison.distance}/256). Too close to call, so recorded as no information.`,
            'unavailable',
          ),
        );
      }
    }

    // --- internal conflicts within the cluster
    conflicts.push(...detectInternalConflicts(cluster));

    const correlationScore = weightedScore(signals);
    const available = signals.filter((s) => s.score !== null).length;

    const verdict: Candidate['verdict'] =
      available < 2
        ? 'INSUFFICIENT'
        : correlationScore >= 0.8
          ? 'STRONG'
          : correlationScore >= 0.55
            ? 'PROBABLE'
            : correlationScore >= 0.3
              ? 'WEAK'
              : 'INSUFFICIENT';

    const primary =
      cluster.find((r) => r.sourceType === 'public_profile') ??
      cluster.find((r) => r.sourceType === 'official_organization') ??
      cluster[0];

    candidates.push({
      id: shortId('cand'),
      rank: 0,
      // A site may publish a handle but no display name. Label the candidate
      // by its handle rather than "Unnamed subject"; `person` stays null in the
      // underlying records, so nothing claims the handle IS the person's name.
      name: agg.names[0] ?? agg.usernames[0] ?? 'Unnamed subject',
      aliases: agg.names.slice(1),
      usernames: agg.usernames,
      platform: primary.source,
      sourceType: primary.sourceType,
      url: primary.url,
      organization: agg.organizations[0] ?? null,
      location: agg.locations[0] ?? null,
      role: agg.roles[0] ?? null,
      projects: agg.projects,
      events: agg.events,
      publications: agg.publications,
      avatarUrl: avatar ?? null,
      bio: cluster.find((r) => r.bio)?.bio ?? null,
      signals,
      conflicts: uniq(conflicts),
      correlationScore,
      verdict,
      provenance: primary.provenance,
      reliability: primary.reliability,
      recordIds: cluster.map((r) => r.id),
    });
  }

  candidates.sort((a, b) => b.correlationScore - a.correlationScore);
  candidates.forEach((c, i) => (c.rank = i + 1));
  return candidates;
}

function weightedScore(signals: CorrelationSignal[]): number {
  const available = signals.filter((s) => s.score !== null);
  if (!available.length) return 0;
  const totalWeight = available.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const raw = available.reduce((sum, s) => sum + (s.score ?? 0) * s.weight, 0) / totalWeight;

  // A single available signal should never produce a confident answer.
  const breadthPenalty = available.length >= 5 ? 1 : 0.55 + available.length * 0.09;
  return clamp01(raw * breadthPenalty);
}

function overlapScore(needles: string[], haystack: string[], name?: string) {
  let best = { score: 0, detail: '' };
  for (const n of needles) {
    for (const h of haystack) {
      const s = normalize(h).includes(normalize(n)) ? 0.85 : nameSimilarity(n, h);
      if (s > best.score) best = { score: s, detail: `"${n}" appears in "${h}"` };
    }
  }
  if (!best.score && haystack.length && name) {
    best = { score: 0.35, detail: `Projects published but no supplied clue matches them.` };
  }
  return best;
}

/**
 * Counts RECIPROCAL link pairs only — each side must link back to the other.
 * A lone one-way link (a mention, an aggregator listing) is weak evidence and
 * inflated this score enough on its own to look like a confident match; only
 * a genuine mutual reference between two of this candidate's own pages counts.
 * Each mutual pair is counted once, not once per direction.
 */
function countCrossLinks(cluster: NormalizedRecord[]) {
  const examples: string[] = [];
  let total = 0;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const a = cluster[i];
      const b = cluster[j];
      const aToB = a.links.some((l) => urlKey(l) === urlKey(b.url));
      const bToA = b.links.some((l) => urlKey(l) === urlKey(a.url));
      if (aToB && bToA) {
        total += 1;
        examples.push(`${a.source} ↔ ${b.source}`);
      }
    }
  }
  return { total, examples: uniq(examples) };
}

function detectInternalConflicts(cluster: NormalizedRecord[]): string[] {
  const out: string[] = [];

  const locs = uniq(cluster.flatMap((r) => r.locations.map((l) => l.split(',')[0].trim())));
  if (locs.length > 1) {
    out.push(`Conflicting locations across sources: ${locs.join(' / ')}.`);
  }

  const years = uniq(
    cluster
      .flatMap((r) => r.dates)
      .map((d) => (/\d{4}/.exec(d)?.[0] ?? ''))
      .filter(Boolean),
  );
  const orgRecords = cluster.filter((r) => r.sourceType === 'official_organization' && r.dates.length);
  const siteRecords = cluster.filter((r) => r.sourceType === 'personal_website' && r.dates.length);
  if (orgRecords.length && siteRecords.length) {
    const a = /\d{4}/.exec(orgRecords[0].dates[0])?.[0];
    const b = /\d{4}/.exec(siteRecords[0].dates[0])?.[0];
    if (a && b && a !== b) {
      out.push(`Employment start year differs between sources: ${a} vs ${b}.`);
    }
  }
  void years;

  return out;
}