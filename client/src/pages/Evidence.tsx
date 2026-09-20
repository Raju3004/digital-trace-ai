import { useState } from 'react';
import { ExternalLink, Filter, Search, ShieldCheck } from 'lucide-react';
import {
  ConfidenceBar,
  EmptyState,
  Expandable,
  Metric,
  PageHeader,
  Panel,
  PanelHeader,
  ProvenanceTag,
  ReliabilityTag,
  SectionTitle,
  StatusTag,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { EvidenceItem, EvidenceStatus } from '../types';

const STATUSES: EvidenceStatus[] = ['Verified', 'Supported', 'Uncertain', 'Conflict', 'Unavailable'];

export default function Evidence() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);

  return (
    <RequireInvestigation>
      {(inv) => {
        const sources = [...new Set(inv.evidence.map((e) => e.source))];
        // Computed inline rather than memoized: this body runs inside a render
        // prop, so a hook here would change hook order when the guard bails out.
        const counts: Record<string, number> = {};
        for (const e of inv.evidence) counts[e.status] = (counts[e.status] ?? 0) + 1;

        const filtered = inv.evidence.filter((e) => {
          if (statusFilter !== 'all' && e.status !== statusFilter) return false;
          if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
          if ((e.confidence ?? 0) * 100 < minConfidence && e.status !== 'Unavailable') return false;
          if (minConfidence > 0 && e.status === 'Unavailable') return false;
          if (!query.trim()) return true;
          return `${e.finding} ${e.source} ${e.supportingEvidence}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        });

        return (
          <>
            <PageHeader
              eyebrow="Verification"
              title="Evidence Center"
              subtitle="Every finding carries its source, the exact supporting excerpt, its provenance and a status. A claim asserted only by the subject's own page is never marked Verified."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)} className="text-left">
                  <Panel
                    hover
                    className={cx(
                      'p-4 transition-all',
                      statusFilter === s && 'border-violet-core/40 bg-violet-core/[0.06]',
                    )}
                  >
                    <div className="label-xs">{s}</div>
                    <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
                      {counts[s] ?? 0}
                    </div>
                  </Panel>
                </button>
              ))}
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  className="input pl-9"
                  placeholder="Search findings…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="input w-auto py-2.5 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EvidenceStatus | 'all')}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="input w-auto py-2.5 text-xs"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.09] bg-ink-950/50 px-3.5 py-2">
                <Filter size={13} className="text-slate-600" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-core"
                />
                <span className="w-9 font-mono text-xs tabular-nums text-slate-300">{minConfidence}%</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No finding matches the current filters"
                message="Widen the filters to see the rest of the evidence collected for this investigation."
                action={
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setQuery('');
                      setStatusFilter('all');
                      setSourceFilter('all');
                      setMinConfidence(0);
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <Panel className="divide-y divide-white/[0.05]">
                {filtered.map((e) => (
                  <EvidenceRow key={e.id} item={e} />
                ))}
              </Panel>
            )}

            <div className="mt-6">
              <SectionTitle>Retrieval Log</SectionTitle>
              <Panel>
                <PanelHeader
                  title="Every source attempt in this run"
                  subtitle="Sources that could not be retrieved are reported, not hidden — and never replaced with substitute content."
                  icon={<ShieldCheck size={16} />}
                />
                <div className="scroll-thin max-h-[300px] divide-y divide-white/[0.05] overflow-y-auto">
                  {inv.attempts.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-2.5">
                      <span
                        className={cx(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          a.ok ? 'bg-emerald-400' : 'bg-slate-600',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11px] text-slate-400">{a.url}</div>
                        {!a.ok && <div className="mt-0.5 text-[11px] text-slate-600">{a.reason}</div>}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-600">
                        {a.elapsedMs}ms
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        );
      }}
    </RequireInvestigation>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  return (
    <div className="px-5 py-4 transition-colors hover:bg-white/[0.015]">
      <Expandable
        header={
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-slate-100">{item.finding}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>{item.source}</span>
                <span className="text-slate-700">·</span>
                <span>{item.supportingEvidence}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusTag value={item.status} />
              <span
                className={cx(
                  'font-mono text-[13px] tabular-nums',
                  item.confidence === null ? 'text-slate-600' : 'text-slate-200',
                )}
              >
                {item.confidence === null ? 'n/a' : `${Math.round(item.confidence * 100)}%`}
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="label-xs mb-1">Source URL</div>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-cyan-soft hover:underline"
              >
                <ExternalLink size={10} className="shrink-0" />
                {item.url}
              </a>
            </div>
            <div>
              <div className="label-xs mb-1">Classification</div>
              <div className="flex flex-wrap items-center gap-2">
                <ReliabilityTag value={item.reliability} />
                <ProvenanceTag value={item.provenance} />
              </div>
            </div>
          </div>

          {item.excerpt && (
            <div>
              <div className="label-xs mb-1">Supporting excerpt</div>
              <p className="border-l-2 border-violet-core/40 pl-3 text-[12px] leading-relaxed text-slate-300">
                {item.excerpt}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ConfidenceBar value={item.confidence} label="Prototype confidence" compact />
            <div>
              <div className="label-xs mb-1">Retrieved</div>
              <div className="font-mono text-[11px] text-slate-400">
                {new Date(item.discoveredAt).toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </div>
      </Expandable>
    </div>
  );
}
