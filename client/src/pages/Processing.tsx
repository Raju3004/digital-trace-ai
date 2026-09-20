import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleAlert,
  Info,
  Loader2,
  Sparkles,
  Tag,
  XCircle,
} from 'lucide-react';
import {
  ErrorState,
  Panel,
  PanelHeader,
  PageHeader,
  ProvenanceTag,
  SectionTitle,
  cx,
} from '../components/ui';
import { api, ApiError } from '../services/api';
import { useApp } from '../context/AppContext';
import type { Investigation } from '../types';

const STAGES = [
  { key: 'input', label: 'Input validated' },
  { key: 'clues', label: 'Context extracted' },
  { key: 'clues2', label: 'Search clues generated' },
  { key: 'discovery', label: 'Public sources discovered' },
  { key: 'candidates', label: 'Collecting candidates' },
  { key: 'correlation', label: 'Correlating identities' },
  { key: 'evidence', label: 'Verifying evidence' },
  { key: 'conflicts', label: 'Detecting conflicts' },
  { key: 'graph', label: 'Building relationship graph' },
  { key: 'timeline', label: 'Building timeline' },
  { key: 'report', label: 'Generating intelligence report' },
];

const LEVEL_ICON = {
  info: <Info size={12} className="text-cyan-soft" />,
  success: <Check size={12} className="text-emerald-400" />,
  warn: <AlertTriangle size={12} className="text-amber-300" />,
  error: <XCircle size={12} className="text-rose-400" />,
};

export default function Processing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setInvestigation, pushToast, mode } = useApp();

  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<Investigation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Kick off the real analysis immediately.
  useEffect(() => {
    if (!id || started.current) return;
    started.current = true;
    api
      .analyze(id)
      .then((inv) => {
        setResult(inv);
        setInvestigation(inv);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unexpected error.'));
  }, [id, setInvestigation]);

  // Step the visual stage list. In Demo Mode the delays are deliberate so the
  // pipeline is legible; in Public Source Mode they track the real request time.
  useEffect(() => {
    if (error) return;
    if (stageIndex >= STAGES.length) {
      setAnimationDone(true);
      return;
    }
    const base = mode === 'demo' ? 330 : 210;
    const t = setTimeout(() => setStageIndex((i) => i + 1), base + Math.random() * 140);
    return () => clearTimeout(t);
  }, [stageIndex, error, mode]);

  // Navigate on once both the animation and the request have finished.
  useEffect(() => {
    if (!animationDone || !result) return;
    const t = setTimeout(() => {
      if (result.status === 'failed') {
        pushToast({ title: 'Analysis failed', message: 'See the activity log for details.', tone: 'error' });
      } else if (result.status === 'insufficient_evidence') {
        pushToast({
          title: 'Insufficient evidence',
          message: 'No reliable identity match could be established. The report explains why.',
          tone: 'warn',
        });
      } else {
        pushToast({
          title: 'Analysis complete',
          message: `${result.candidates.length} candidate(s), ${result.evidence.length} finding(s).`,
          tone: 'success',
        });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [animationDone, result, pushToast]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [result, stageIndex]);

  const clues = result?.clues ?? [];
  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const c of clues) {
      if (c.origin === 'derived_from_discovery' && c.type === 'username') continue;
      (g[c.type] ??= []).push(c.value);
    }
    return g;
  }, [clues]);

  const complete = animationDone && Boolean(result);

  if (error) {
    return (
      <ErrorState
        title="Analysis could not be started"
        message={error}
        retry={() => navigate('/new')}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Processing"
        title={complete ? 'Analysis Complete' : 'Investigation Running'}
        subtitle={
          complete
            ? 'Every stage below was executed by the backend pipeline. Open the identity overview to review the result.'
            : 'Input processing, public-source discovery, correlation and evidence verification are running.'
        }
        actions={
          complete && (
            <Link to="/identity" className="btn-primary">
              Open Identity Overview
              <ArrowRight size={15} />
            </Link>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Stages */}
        <div>
          <SectionTitle>Input Processing</SectionTitle>
          <Panel className="p-5">
            <ol className="space-y-1">
              {STAGES.map((s, i) => {
                const done = i < stageIndex;
                const active = i === stageIndex;
                return (
                  <li
                    key={s.key}
                    className={cx(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-300',
                      active && 'bg-violet-core/[0.08]',
                    )}
                  >
                    <span
                      className={cx(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all duration-300',
                        done
                          ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                          : active
                            ? 'border-violet-core/50 bg-violet-core/15 text-violet-soft animate-pulse-ring'
                            : 'border-white/[0.09] text-slate-700',
                      )}
                    >
                      {done ? (
                        <Check size={11} />
                      ) : active ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current" />
                      )}
                    </span>
                    <span
                      className={cx(
                        'text-[13px] transition-colors duration-300',
                        done ? 'text-slate-300' : active ? 'text-white' : 'text-slate-600',
                      )}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {complete && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] px-3.5 py-2.5 animate-fade-up">
                <Sparkles size={14} className="text-emerald-300" />
                <span className="text-[12px] font-medium text-emerald-200">
                  ANALYSIS COMPLETE — {result?.records.length ?? 0} record(s), {result?.candidates.length ?? 0} candidate(s)
                </span>
              </div>
            )}
          </Panel>

          {/* Extracted clues */}
          {Object.keys(grouped).length > 0 && (
            <div className="mt-6 animate-fade-up">
              <SectionTitle>Extracted Clues</SectionTitle>
              <Panel className="p-5">
                <div className="space-y-3">
                  {Object.entries(grouped).map(([type, values]) => (
                    <div key={type} className="flex flex-wrap items-baseline gap-2">
                      <span className="label-xs w-28 shrink-0">
                        {type === 'keyword' ? 'Detected keywords' : type}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {values.map((v) => (
                          <span
                            key={v}
                            className="chip border-white/[0.09] bg-white/[0.03] text-slate-300"
                          >
                            <Tag size={10} className="text-slate-500" />
                            {v.startsWith('aHash:') ? v : v}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {clues.some((c) => c.origin === 'derived_from_discovery') && (
                  <div className="mt-4 border-t border-white/[0.07] pt-3">
                    <div className="label-xs mb-2">Derived handle permutations</div>
                    <div className="flex flex-wrap gap-1.5">
                      {clues
                        .filter((c) => c.origin === 'derived_from_discovery')
                        .map((c) => (
                          <span
                            key={c.id}
                            className="chip border-dashed border-slate-600/40 bg-transparent font-mono text-slate-500"
                            title={c.note}
                          >
                            {c.value}
                          </span>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                      Generated, not observed. Each is unverified until a public source confirms it.
                    </p>
                  </div>
                )}

                {result?.imageSignal.provided && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
                    <CircleAlert size={12} className="mt-0.5 shrink-0" />
                    <span>Prototype image signal — no face recognition is performed.</span>
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>

        {/* Live activity */}
        <div>
          <SectionTitle>Live Activity</SectionTitle>
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Pipeline log"
              subtitle="Timestamped events emitted by the backend during this run."
              actions={
                result && (
                  <ProvenanceTag value={result.mode === 'demo' ? 'DEMO_DATA' : 'PUBLIC_SOURCE'} />
                )
              }
            />
            <div ref={logRef} className="scroll-thin max-h-[520px] overflow-y-auto p-4">
              {!result ? (
                <div className="space-y-2.5">
                  {STAGES.slice(0, stageIndex + 1).map((s, i) => (
                    <div key={i} className="flex items-start gap-3 font-mono text-[11px] animate-fade-in">
                      <span className="shrink-0 text-slate-600">
                        {new Date().toLocaleTimeString('en-GB')}
                      </span>
                      <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin text-violet-soft" />
                      <span className="text-slate-400">{s.label}…</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {result.processingLog.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-md px-1.5 py-1 font-mono text-[11px] animate-fade-in hover:bg-white/[0.02]"
                    >
                      <span className="shrink-0 text-slate-600">
                        {new Date(e.at).toLocaleTimeString('en-GB')}
                      </span>
                      <span className="mt-0.5 shrink-0">{LEVEL_ICON[e.level]}</span>
                      <span
                        className={cx(
                          'leading-relaxed',
                          e.level === 'error'
                            ? 'text-rose-300'
                            : e.level === 'warn'
                              ? 'text-amber-200'
                              : e.level === 'success'
                                ? 'text-slate-300'
                                : 'text-slate-400',
                        )}
                      >
                        {e.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result && result.attempts.some((a) => !a.ok) && (
              <div className="border-t border-white/[0.07] px-5 py-3">
                <div className="label-xs mb-2">Sources unavailable for automated retrieval</div>
                <div className="scroll-thin max-h-32 space-y-1.5 overflow-y-auto">
                  {result.attempts
                    .filter((a) => !a.ok)
                    .slice(0, 8)
                    .map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <XCircle size={11} className="mt-0.5 shrink-0 text-slate-600" />
                        <div className="min-w-0">
                          <div className="truncate font-mono text-slate-500">{a.url}</div>
                          <div className="text-slate-600">{a.reason}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
