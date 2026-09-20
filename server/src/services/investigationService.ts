import type {
  DataMode,
  Investigation,
  InvestigationSummary,
  ImageSignal,
  KnownContext,
  ProcessingEvent,
} from '../types/index.js';
import { nowIso, shortId } from '../utils/ids.js';
import { extractClues } from './clueService.js';
import { discoverPublicSources } from './discoveryService.js';
import { correlateCandidates } from './correlationService.js';
import { detectConflicts, verifyEvidence } from './evidenceService.js';
import { buildKnowledgeGraph } from './graphService.js';
import { buildTimeline } from './timelineService.js';
import { buildDiscoveryChain, generateReport } from './reportService.js';
import { DEMO_CONTEXT } from '../data/mockRecords.js';
import { attachAvatarHashes } from './imageSignalService.js';
import { uniq } from '../utils/text.js';

/** In-memory store. Swap for a database without touching the services. */
const store = new Map<string, Investigation>();

export function listInvestigations(): InvestigationSummary[] {
  return [...store.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((inv) => ({
      id: inv.id,
      label: inv.label,
      mode: inv.mode,
      status: inv.status,
      createdAt: inv.createdAt,
      subject: inv.context.fullName || inv.context.username || 'Unidentified subject',
      confidence: inv.stats.averageConfidence,
      sources: inv.stats.sourcesRetrieved,
      candidates: inv.stats.candidatesFound,
    }));
}

export function getInvestigation(id: string): Investigation | undefined {
  return store.get(id);
}

export function createInvestigation(args: {
  context: KnownContext;
  image: ImageSignal;
  mode: DataMode;
  label?: string;
}): Investigation {
  const id = shortId('inv');
  // Demo Data Mode always analyzes the built-in fixture, so labelling the case
  // with the operator's typed name would misrepresent what was analyzed.
  const subjectLabel =
    args.mode === 'demo'
      ? 'Rahul Kumar (built-in demo subject)'
      : args.context.fullName || args.context.username || 'Subject';

  const investigation: Investigation = {
    id,
    label: args.label ?? `${subjectLabel} — ${new Date().toLocaleDateString('en-GB')}`,
    mode: args.mode,
    status: 'created',
    createdAt: nowIso(),
    context: args.context,
    imageSignal: args.image,
    clues: [],
    attempts: [],
    records: [],
    candidates: [],
    evidence: [],
    conflicts: [],
    graph: { nodes: [], edges: [] },
    timeline: [],
    discoveryChain: [],
    processingLog: [],
    report: null,
    stats: {
      sourcesAttempted: 0,
      sourcesRetrieved: 0,
      candidatesFound: 0,
      profilesCorrelated: 0,
      evidenceItems: 0,
      conflicts: 0,
      averageConfidence: null,
    },
  };
  store.set(id, investigation);
  return investigation;
}

function log(inv: Investigation, stage: string, message: string, level: ProcessingEvent['level'] = 'info') {
  inv.processingLog.push({ at: nowIso(), stage, message, level });
}

/**
 * Runs the full pipeline:
 *   clues → discovery → candidates → correlation → evidence → conflicts →
 *   graph → timeline → report
 *
 * Any single stage failing degrades that stage only; the investigation still
 * completes with whatever was established.
 */
export async function analyzeInvestigation(id: string): Promise<Investigation> {
  const inv = store.get(id);
  if (!inv) throw new Error(`Investigation ${id} not found.`);

  inv.status = 'processing';
  inv.processingLog = [];

  try {
    log(inv, 'input', 'Input validated.', 'success');
    log(
      inv,
      'input',
      inv.imageSignal.provided
        ? `Authorized image accepted (${inv.imageSignal.fileName ?? 'image'}). Used as a prototype signal only — no face recognition is performed.`
        : 'No image supplied. Proceeding with contextual clues only.',
      inv.imageSignal.provided ? 'success' : 'warn',
    );

    // Demo Data Mode analyzes a fixed synthetic subject. Extracting clues from
    // whatever the operator typed would score their text against an unrelated
    // fixture and produce a meaningless number, so the demo context is used
    // instead — and the substitution is stated plainly in the log.
    const analysisContext = inv.mode === 'demo' ? DEMO_CONTEXT : inv.context;
    if (inv.mode === 'demo') {
      const typed = Object.values(inv.context).some(Boolean);
      log(
        inv,
        'clues',
        typed
          ? 'Demo Data Mode: the context you entered is NOT searched. Clues are taken from the built-in demo subject (Rahul Kumar) so the pipeline stays coherent. Switch to Public Source Mode to analyze real input.'
          : 'Demo Data Mode: using the built-in demo subject (Rahul Kumar).',
        'warn',
      );
    }

    inv.clues = extractClues(analysisContext, inv.imageSignal);
    log(inv, 'clues', `${inv.clues.length} search clue(s) generated.`, 'success');

    const discovery = await discoverPublicSources(inv.clues, {
      mode: inv.mode,
      onProgress: (stage, message, level) => log(inv, stage, message, level ?? 'info'),
    });
    inv.records = discovery.records;
    inv.attempts = discovery.attempts;

    if (!inv.records.length) {
      inv.status = 'insufficient_evidence';
      log(
        inv,
        'discovery',
        'No public source could be retrieved. Analysis cannot continue beyond this point.',
        'error',
      );
      inv.report = generateReport({
        mode: inv.mode,
        records: [],
        candidates: [],
        evidence: verifyEvidence([], [], inv.attempts),
        conflicts: [],
      });
      inv.evidence = inv.report ? verifyEvidence([], [], inv.attempts) : [];
      inv.stats = {
        sourcesAttempted: inv.attempts.length,
        sourcesRetrieved: 0,
        candidatesFound: 0,
        profilesCorrelated: 0,
        evidenceItems: inv.evidence.length,
        conflicts: 0,
        averageConfidence: null,
      };
      inv.completedAt = nowIso();
      return inv;
    }

    // Hash any published avatars so the authorized photograph can be compared
    // against candidates that were already found by other means.
    if (inv.imageSignal.provided && inv.imageSignal.aHash && inv.mode === 'public') {
      await attachAvatarHashes(inv.records, (message, level) =>
        log(inv, 'image', message, level),
      );
    }

    log(inv, 'candidates', `${inv.records.length} normalized record(s) available for correlation.`, 'info');

    inv.candidates = correlateCandidates(inv.records, {
      clues: inv.clues,
      image: inv.imageSignal,
    });
    log(
      inv,
      'correlation',
      `${inv.candidates.length} distinct candidate(s) generated from record clustering.`,
      'success',
    );

    inv.evidence = verifyEvidence(inv.records, inv.candidates, inv.attempts);
    log(inv, 'evidence', `${inv.evidence.length} finding(s) assembled with provenance.`, 'success');

    inv.conflicts = detectConflicts(inv.records, inv.candidates);
    log(
      inv,
      'conflicts',
      inv.conflicts.length
        ? `${inv.conflicts.length} conflict(s) detected and retained for review.`
        : 'No conflicts detected between sources.',
      inv.conflicts.length ? 'warn' : 'success',
    );

    inv.graph = buildKnowledgeGraph(inv.records, inv.candidates);
    log(inv, 'graph', `Relationship graph built: ${inv.graph.nodes.length} node(s), ${inv.graph.edges.length} edge(s).`, 'success');

    inv.timeline = buildTimeline(inv.records, inv.candidates);
    log(inv, 'timeline', `${inv.timeline.length} dated activity entr(ies) placed on the timeline.`, 'success');

    inv.discoveryChain = buildDiscoveryChain(inv.records, inv.candidates);

    inv.report = generateReport({
      mode: inv.mode,
      records: inv.records,
      candidates: inv.candidates,
      evidence: inv.evidence,
      conflicts: inv.conflicts,
    });
    log(inv, 'report', 'Intelligence report generated.', 'success');

    const top = inv.candidates[0];
    const insufficient = !top || top.verdict === 'INSUFFICIENT';
    inv.status = insufficient ? 'insufficient_evidence' : 'complete';
    inv.completedAt = nowIso();

    inv.stats = {
      sourcesAttempted: inv.attempts.length,
      sourcesRetrieved: inv.attempts.filter((a) => a.ok).length,
      candidatesFound: inv.candidates.length,
      profilesCorrelated: top ? top.recordIds.length : 0,
      evidenceItems: inv.evidence.length,
      conflicts: inv.conflicts.length,
      averageConfidence: insufficient ? null : top!.correlationScore,
    };

    if (insufficient) {
      log(
        inv,
        'report',
        'Insufficient evidence to establish a reliable identity match. No identity asserted.',
        'warn',
      );
    }

    return inv;
  } catch (err) {
    inv.status = 'failed';
    log(
      inv,
      'error',
      `Analysis failed: ${err instanceof Error ? err.message : 'unknown error'}.`,
      'error',
    );
    inv.completedAt = nowIso();
    return inv;
  }
}

/** Aggregate KPI values across every stored investigation. */
export function dashboardStats() {
  const all = [...store.values()];
  const complete = all.filter((i) => i.status === 'complete');
  const confidences = complete
    .map((i) => i.stats.averageConfidence)
    .filter((c): c is number => c !== null);

  return {
    investigations: all.length,
    candidatesFound: all.reduce((s, i) => s + i.stats.candidatesFound, 0),
    profilesCorrelated: all.reduce((s, i) => s + i.stats.profilesCorrelated, 0),
    evidenceSources: uniq(all.flatMap((i) => i.records.map((r) => r.url))).length,
    averageConfidence: confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null,
    conflictsDetected: all.reduce((s, i) => s + i.stats.conflicts, 0),
    active: complete.length
      ? {
          id: complete[complete.length - 1].id,
          label: complete[complete.length - 1].label,
          status: complete[complete.length - 1].status,
          confidence: complete[complete.length - 1].stats.averageConfidence,
          sources: complete[complete.length - 1].stats.sourcesRetrieved,
          profiles: complete[complete.length - 1].stats.profilesCorrelated,
          organizations: uniq(
            complete[complete.length - 1].records.flatMap((r) => r.organizations),
          ).length,
          events: uniq(complete[complete.length - 1].records.flatMap((r) => r.events)).length,
          projects: uniq(complete[complete.length - 1].records.flatMap((r) => r.projects)).length,
          mode: complete[complete.length - 1].mode,
        }
      : null,
  };
}
