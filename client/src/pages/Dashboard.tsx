import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarRange,
  FileSearch,
  FolderGit2,
  Layers,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import {
  ConfidenceRing,
  EmptyState,
  ErrorState,
  Loading,
  Metric,
  Panel,
  PanelHeader,
  PageHeader,
  SectionTitle,
  cx,
} from '../components/ui';
import { api, ApiError, type DashboardStats, type SourceStatus } from '../services/api';
import { useApp } from '../context/AppContext';

const PIPELINE = [
  'Authorized image + limited context',
  'Input & clue extraction',
  'Public source discovery',
  'Candidate generation',
  'Identity correlation',
  'Evidence verification',
  'Relationship graph + timeline',
  'Intelligence report',
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sources, setSources] = useState<SourceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { loadInvestigation } = useApp();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, src] = await Promise.all([api.dashboard(), api.sources()]);
      setStats(s);
      setSources(src);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !stats) return <Loading label="Loading platform state" />;
  if (error) return <ErrorState title="Analysis service unreachable" message={error} retry={load} />;

  const enabled = sources?.allowlist.filter((d) => d.enabled).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Digital Identity Intelligence"
        subtitle="AI-assisted public footprint discovery, identity correlation and evidence verification."
        actions={
          <Link to="/new" className="btn-primary">
            <Plus size={15} />
            New Investigation
          </Link>
        }
      />

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Investigations" value={stats?.investigations ?? 0} icon={<FileSearch size={15} />} tone="violet" />
        <Metric label="Candidates Found" value={stats?.candidatesFound ?? 0} icon={<Users size={15} />} />
        <Metric label="Profiles Correlated" value={stats?.profilesCorrelated ?? 0} icon={<Layers size={15} />} tone="cyan" />
        <Metric label="Evidence Sources" value={stats?.evidenceSources ?? 0} icon={<ShieldCheck size={15} />} />
        <Metric
          label="Average Confidence"
          value={stats?.averageConfidence === null || stats?.averageConfidence === undefined ? 'n/a' : `${Math.round(stats.averageConfidence * 100)}%`}
          icon={<Target size={15} />}
          tone="violet"
          hint="Prototype correlation score"
        />
        <Metric label="Conflicts Detected" value={stats?.conflictsDetected ?? 0} icon={<ShieldAlert size={15} />} tone="warn" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Active investigation */}
        <div>
          <SectionTitle>Active Investigation</SectionTitle>
          {stats?.active ? (
            <Panel className="overflow-hidden">
              <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
                <ConfidenceRing value={stats.active.confidence} size={104} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{stats.active.label}</h3>
                    <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                      Analysis Complete
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-slate-600">{stats.active.id}</p>

                  <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
                    {[
                      { label: 'Sources', value: stats.active.sources, icon: ShieldCheck },
                      { label: 'Profiles', value: stats.active.profiles, icon: Layers },
                      { label: 'Organizations', value: stats.active.organizations, icon: Building2 },
                      { label: 'Events', value: stats.active.events, icon: CalendarRange },
                      { label: 'Projects', value: stats.active.projects, icon: FolderGit2 },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <m.icon size={12} />
                          <span className="label-xs">{m.label}</span>
                        </div>
                        <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-white/[0.015] px-6 py-3.5">
                <span className="text-[11px] text-slate-500">
                  Identity confidence is a prototype correlation score, not a calibrated probability.
                </span>
                <button
                  className="btn-primary shrink-0"
                  onClick={async () => {
                    const inv = await loadInvestigation(stats.active!.id);
                    if (inv) navigate('/identity');
                  }}
                >
                  Open Investigation
                  <ArrowRight size={15} />
                </button>
              </div>
            </Panel>
          ) : (
            <EmptyState
              icon={<Sparkles size={20} />}
              title="No completed investigation yet"
              message="Run the jury demo in one pass: start a new investigation, upload an authorized photograph, enter the known context and watch the pipeline execute."
              action={
                <Link to="/new" className="btn-primary">
                  <Plus size={15} />
                  Start new investigation
                </Link>
              }
            />
          )}

          <div className="mt-6">
            <SectionTitle hint="every stage is executed by the backend, not simulated in the UI">
              Analysis Pipeline
            </SectionTitle>
            <Panel className="p-5">
              <ol className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {PIPELINE.map((step, i) => (
                  <li key={step} className="flex items-center gap-3 text-[13px] text-slate-400">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/[0.09] bg-white/[0.03] font-mono text-[10px] text-violet-soft">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>

        {/* Source governance */}
        <div>
          <SectionTitle>Source Governance</SectionTitle>
          <Panel>
            <PanelHeader
              title="Domain allowlist"
              subtitle={`${enabled} of ${sources?.allowlist.length ?? 0} configured domains enabled for automated retrieval.`}
              icon={<ShieldCheck size={16} />}
            />
            <div className="scroll-thin max-h-[290px] divide-y divide-white/[0.05] overflow-y-auto">
              {sources?.allowlist.map((d) => (
                <div key={d.domain} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[12px] text-slate-200">{d.domain}</span>
                    <span
                      className={cx(
                        'chip shrink-0',
                        d.enabled
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                          : 'border-slate-500/25 bg-slate-500/10 text-slate-500',
                      )}
                    >
                      {d.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{d.basis}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.07] px-5 py-3 text-[11px] leading-relaxed text-slate-500">
              Requests to any domain outside this list are refused before they leave the process.
              robots.txt, path restrictions and per-host rate limits are enforced on every request.
            </div>
          </Panel>

          <div className="mt-6">
            <SectionTitle>Source Reliability</SectionTitle>
            <Panel className="divide-y divide-white/[0.05]">
              {sources?.reliability.map((r) => (
                <div key={r.sourceType} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="truncate text-[12px] text-slate-300">{r.label}</span>
                  <span
                    className={cx(
                      'chip shrink-0',
                      r.reliability === 'High'
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                        : r.reliability === 'Medium-High'
                          ? 'border-cyan-core/25 bg-cyan-core/10 text-cyan-soft'
                          : r.reliability === 'Medium'
                            ? 'border-slate-400/25 bg-slate-400/10 text-slate-300'
                            : 'border-amber-400/25 bg-amber-400/10 text-amber-300',
                    )}
                  >
                    {r.reliability}
                  </span>
                </div>
              ))}
              <div className="px-5 py-3 text-[11px] leading-relaxed text-slate-500">
                {sources?.note}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
