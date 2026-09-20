import type {
  Candidate,
  Conflict,
  DataMode,
  DiscoveryStep,
  EvidenceItem,
  IntelligenceReport,
  NormalizedRecord,
} from '../types/index.js';
import { nowIso, shortId } from '../utils/ids.js';
import { uniq } from '../utils/text.js';

/**
 * ITERATIVE DISCOVERY CHAIN
 *
 * Records how each reliable finding became the clue for the next step, so the
 * investigation can be replayed and audited rather than taken on trust.
 */
export function buildDiscoveryChain(
  records: NormalizedRecord[],
  candidates: Candidate[],
): DiscoveryStep[] {
  const top = candidates[0];
  if (!top) return [];

  const cluster = records.filter((r) => top.recordIds.includes(r.id));
  const steps: DiscoveryStep[] = [];
  let order = 1;

  const add = (
    label: string,
    discovered: string,
    rec: NormalizedRecord,
    producedClue: string | null,
  ) => {
    steps.push({
      id: shortId('step'),
      order: order++,
      label,
      discovered,
      source: rec.source,
      url: rec.url,
      evidence: rec.rawEvidence[0]?.excerpt ?? rec.title,
      producedClue,
      provenance: rec.provenance,
    });
  };

  const profile = cluster.find((r) => r.sourceType === 'public_profile');
  if (profile) {
    add(
      'Public profile located',
      `${profile.person ?? 'Subject'} — handle "${profile.usernames[0] ?? 'n/a'}"`,
      profile,
      profile.organizations[0] ? `Organization: ${profile.organizations[0]}` : 'Repository names',
    );
  }

  const repo = cluster.find((r) => r.sourceType === 'public_repository');
  if (repo) {
    add(
      'Project identified',
      repo.projects[0] ?? repo.title,
      repo,
      repo.projects[0] ? `Project name: ${repo.projects[0]}` : null,
    );
  }

  const org = cluster.find((r) => r.sourceType === 'official_organization');
  if (org) {
    add(
      'Organization page confirmed',
      `${org.roles[0] ?? 'Affiliation'} at ${org.organizations[0] ?? org.source}`,
      org,
      org.organizations[0] ? `Employer: ${org.organizations[0]}` : null,
    );
  }

  for (const ev of cluster.filter((r) => r.sourceType === 'event_listing')) {
    add(
      'Event participation found',
      `${ev.roles[0] ?? 'Listed'} — ${ev.events[0] ?? ev.title}`,
      ev,
      ev.usernames[0] ? `Alternate handle: ${ev.usernames[0]}` : null,
    );
  }

  const pub = cluster.find((r) => r.sourceType === 'publication');
  if (pub) {
    add('Publication located', pub.publications[0] ?? pub.title, pub, 'Co-author names');
  }

  const site = cluster.find((r) => r.sourceType === 'personal_website');
  if (site) {
    add(
      'Personal website corroborates links',
      `Links to ${site.links.length} other public page(s)`,
      site,
      null,
    );
  }

  return steps;
}

/**
 * FINAL INTELLIGENCE REPORT
 *
 * Refuses to force a match. If the evidence does not support a reliable
 * identity, the report says so explicitly.
 */
export function generateReport(args: {
  mode: DataMode;
  records: NormalizedRecord[];
  candidates: Candidate[];
  evidence: EvidenceItem[];
  conflicts: Conflict[];
}): IntelligenceReport {
  const { mode, records, candidates, evidence, conflicts } = args;
  const top = candidates[0];
  const runnerUp = candidates[1];

  const byStatus: Record<string, number> = {};
  for (const e of evidence) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

  const uncertainty: string[] = [];
  const unavailable = evidence.filter((e) => e.status === 'Unavailable').length;
  if (unavailable) {
    uncertainty.push(
      `${unavailable} source(s) could not be retrieved automatically. Findings that would have depended on them are absent, not assumed.`,
    );
  }
  if (conflicts.length) {
    uncertainty.push(
      `${conflicts.length} unresolved conflict(s) remain between sources; no conflicting value was discarded.`,
    );
  }
  uncertainty.push(
    'The correlation score is a prototype heuristic over hand-set weights. It is not a calibrated probability and has not been validated against ground truth.',
  );
  uncertainty.push(
    'No face recognition is performed. The supplied photograph contributes no matching weight in this prototype.',
  );
  if (runnerUp && top && top.correlationScore - runnerUp.correlationScore < 0.15) {
    uncertainty.push(
      `The top two candidates are within ${Math.round((top.correlationScore - runnerUp.correlationScore) * 100)} points of each other — the distinction is weak.`,
    );
  }

  const insufficient = !top || top.verdict === 'INSUFFICIENT' || top.correlationScore < 0.3;

  const cluster = top ? records.filter((r) => top.recordIds.includes(r.id)) : [];

  const report: IntelligenceReport = {
    executiveSummary: insufficient
      ? 'Insufficient evidence to establish a reliable identity match. The public sources retrieved did not produce a candidate supported by enough independent signals to justify an identification.'
      : `Public-source analysis correlated ${cluster.length} record(s) across ${uniq(cluster.map((r) => r.source)).length} distinct source(s) into a single likely identity. The strongest supporting signals are ${top!.signals
          .filter((s) => s.score !== null && s.score >= 0.8)
          .map((s) => s.label.toLowerCase())
          .slice(0, 3)
          .join(', ') || 'partial and should be treated with caution'}. ${
          conflicts.length
            ? `${conflicts.length} conflict(s) between sources remain unresolved and are reported below.`
            : 'No conflicts between sources were detected.'
        }`,
    mostLikelyIdentity: {
      name: insufficient ? null : top!.name,
      confidence: insufficient ? null : top!.correlationScore,
      verdict: insufficient ? 'NONE' : top!.verdict,
      statement: insufficient
        ? 'No reliable candidate found. The system does not assert an identity on this evidence.'
        : `Prototype correlation score ${Math.round(top!.correlationScore * 100)}% across ${
            top!.signals.filter((s) => s.score !== null).length
          } available signals.`,
    },
    nameVariations: top ? uniq([top.name, ...top.aliases]) : [],
    knownUsernames: top?.usernames ?? [],
    publicProfiles: cluster
      .filter((r) => r.sourceType === 'public_profile' || r.sourceType === 'personal_website')
      .map((r) => ({ platform: r.source, url: r.url, provenance: r.provenance })),
    professionalAffiliations: uniq(cluster.flatMap((r) => r.organizations)).map((orgName) => {
      const stating = cluster.filter((r) => r.organizations.includes(orgName));
      // Prefer the source that actually states a role over one that only
      // mentions the organization, so the report shows the fullest fact known.
      const rec = stating.find((r) => r.roles.length) ?? stating[0];
      return { organization: orgName, role: rec.roles[0] ?? null, source: rec.source };
    }),
    publicActivities: cluster
      .filter((r) => r.events.length)
      .map((r) => ({
        name: r.events[0],
        type: r.roles[0] ?? 'Listed',
        source: r.source,
        url: r.url,
      })),
    projects: uniq(cluster.flatMap((r) => r.projects)).map((p) => {
      const rec = cluster.find((r) => r.projects.includes(p))!;
      return { name: p, source: rec.source, url: rec.url };
    }),
    publications: uniq(cluster.flatMap((r) => r.publications)).map((p) => {
      const rec = cluster.find((r) => r.publications.includes(p))!;
      return { title: p, source: rec.source, url: rec.url };
    }),
    evidenceSummary: { total: evidence.length, byStatus },
    confidence: insufficient ? null : top!.correlationScore,
    conflicts,
    uncertainty,
        dataAuthorization:
      'OSINT DEMO DATASET — every finding in this report comes from a bundled, local, synthetic dataset of 2000 demo identities. No live website was contacted, no authentication or private data was accessed, and nothing here describes a real person.',
    generatedAt: nowIso(),
  };

  return report;
}
