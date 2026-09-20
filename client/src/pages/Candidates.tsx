import { useMemo, useState } from 'react';
import { AlertTriangle, AtSign, Building2, Check, ExternalLink, MapPin, Search, X } from 'lucide-react';
import {
  ConfidenceBar,
  EmptyState,
  Modal,
  PageHeader,
  Panel,
  ProvenanceTag,
  ReliabilityTag,
  SectionTitle,
  VerdictTag,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { Candidate } from '../types';

export default function Candidates() {
  const [query, setQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [selected, setSelected] = useState<Candidate | null>(null);

  return (
    <RequireInvestigation>
      {(inv) => {
        const filtered = inv.candidates.filter((c) => {
          const matchesQuery =
            !query.trim() ||
            `${c.name} ${c.usernames.join(' ')} ${c.organization ?? ''} ${c.platform}`
              .toLowerCase()
              .includes(query.trim().toLowerCase());
          return matchesQuery && c.correlationScore * 100 >= minConfidence;
        });

        return (
          <>
            <PageHeader
              eyebrow="Candidate generation"
              title="Candidates"
              subtitle="The system never takes the first result. Every plausible entity is ranked, kept and shown with the signals that support or contradict it."
            />

            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  className="input pl-9"
                  placeholder="Search candidates…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.09] bg-ink-950/50 px-3.5 py-2">
                <span className="label-xs whitespace-nowrap">Min confidence</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-core"
                />
                <span className="w-9 font-mono text-xs tabular-nums text-slate-300">{minConfidence}%</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {filtered.length} of {inv.candidates.length} shown
              </span>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No candidate matches the current filters"
                message="Lower the confidence threshold or clear the search to see the full candidate set."
                action={
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setQuery('');
                      setMinConfidence(0);
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filtered.map((c) => (
                  <Panel key={c.id} hover className="overflow-hidden">
                    <div className="flex items-start gap-4 p-5">
                      <div
                        className={cx(
                          'grid h-11 w-11 shrink-0 place-items-center rounded-lg border font-mono text-[13px] font-semibold',
                          c.rank === 1
                            ? 'border-violet-core/40 bg-violet-core/[0.12] text-violet-soft'
                            : 'border-white/[0.09] bg-white/[0.03] text-slate-500',
                        )}
                      >
                        {String(c.rank).padStart(2, '0')}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-slate-100">{c.name}</h3>
                          <VerdictTag value={c.verdict} />
                          <ProvenanceTag value={c.provenance} />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
                          {c.organization && (
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 size={12} className="text-slate-600" />
                              {c.organization}
                            </span>
                          )}
                          {c.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={12} className="text-slate-600" />
                              {c.location}
                            </span>
                          )}
                          {c.usernames[0] && (
                            <span className="inline-flex items-center gap-1.5 font-mono">
                              <AtSign size={12} className="text-slate-600" />
                              {c.usernames[0]}
                            </span>
                          )}
                        </div>

                        <div className="mt-3.5">
                          <ConfidenceBar value={c.correlationScore} label="Prototype correlation score" />
                        </div>
                      </div>
                    </div>

                    {/* Signals strip */}
                    <div className="border-t border-white/[0.06] px-5 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="label-xs">Matching signals</span>
                        <span className="label-xs">{c.platform}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.signals
                          .filter((s) => s.status === 'match' || s.status === 'conflict')
                          .slice(0, 6)
                          .map((s) => (
                            <span
                              key={s.key}
                              title={s.detail}
                              className={cx(
                                'chip',
                                s.status === 'match'
                                  ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
                                  : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300',
                              )}
                            >
                              {s.status === 'match' ? <Check size={10} /> : <X size={10} />}
                              {s.label}
                              {s.score !== null && (
                                <span className="font-mono tabular-nums opacity-70">
                                  {Math.round(s.score * 100)}%
                                </span>
                              )}
                            </span>
                          ))}
                        {c.signals.filter((s) => s.status === 'unavailable').length > 0 && (
                          <span className="chip border-slate-600/30 bg-slate-600/[0.08] text-slate-500">
                            {c.signals.filter((s) => s.status === 'unavailable').length} unavailable
                          </span>
                        )}
                      </div>

                      {c.conflicts.length > 0 && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                          <span>{c.conflicts[0]}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <ReliabilityTag value={c.reliability} />
                        <span className="text-[11px] text-slate-600">{c.recordIds.length} record(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-cyan-soft"
                        >
                          <ExternalLink size={11} />
                          Source
                        </a>
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setSelected(c)}>
                          Details
                        </button>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            )}

            <Modal
              open={Boolean(selected)}
              onClose={() => setSelected(null)}
              title={selected ? `Candidate ${String(selected.rank).padStart(2, '0')} — ${selected.name}` : ''}
              width="max-w-3xl"
            >
              {selected && <CandidateDetail candidate={selected} />}
            </Modal>
          </>
        );
      }}
    </RequireInvestigation>
  );
}

function CandidateDetail({ candidate }: { candidate: Candidate }) {
  const grouped = useMemo(
    () => ({
      matches: candidate.signals.filter((s) => s.status === 'match'),
      partial: candidate.signals.filter((s) => s.status === 'partial'),
      conflicts: candidate.signals.filter((s) => s.status === 'conflict'),
      unavailable: candidate.signals.filter((s) => s.status === 'unavailable'),
    }),
    [candidate],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictTag value={candidate.verdict} />
        <ProvenanceTag value={candidate.provenance} />
        <ReliabilityTag value={candidate.reliability} />
      </div>

      <ConfidenceBar value={candidate.correlationScore} label="Prototype correlation score" />

      {candidate.bio && (
        <div>
          <div className="label-xs mb-1.5">Published bio</div>
          <p className="text-[13px] leading-relaxed text-slate-300">{candidate.bio}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailList label="Usernames" items={candidate.usernames} mono />
        <DetailList label="Name variations" items={[candidate.name, ...candidate.aliases]} />
        <DetailList label="Projects" items={candidate.projects} />
        <DetailList label="Events" items={candidate.events} />
        <DetailList label="Publications" items={candidate.publications} />
      </div>

      <div>
        <SectionTitle>Signal breakdown</SectionTitle>
        <div className="space-y-2">
          {[
            { label: 'Matching', items: grouped.matches, tone: 'emerald' },
            { label: 'Partial', items: grouped.partial, tone: 'cyan' },
            { label: 'Conflicting', items: grouped.conflicts, tone: 'rose' },
            { label: 'Unavailable', items: grouped.unavailable, tone: 'slate' },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.label}>
                <div className="label-xs mb-1.5">{g.label}</div>
                <div className="space-y-1.5">
                  {g.items.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-start justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-slate-200">{s.label}</div>
                        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{s.detail}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cx(
                            'font-mono text-[13px] tabular-nums',
                            s.score === null ? 'text-slate-600' : 'text-slate-200',
                          )}
                        >
                          {s.score === null ? 'n/a' : `${Math.round(s.score * 100)}%`}
                        </div>
                        <div className="font-mono text-[10px] text-slate-600">
                          w {s.weight.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {candidate.conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3.5">
          <div className="label-xs mb-1.5 text-amber-300">Conflicting information retained</div>
          <ul className="space-y-1 text-[11px] leading-relaxed text-amber-200/90">
            {candidate.conflicts.map((c, i) => (
              <li key={i}>· {c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5 text-[11px] leading-relaxed text-slate-500">
        Weights are hand-set for this prototype and renormalized over the signals that were actually
        available, so an unavailable signal neither helps nor penalizes the candidate. The result is a
        prototype correlation score, not a validated probability.
      </div>
    </div>
  );
}

function DetailList({ label, items, mono }: { label: string; items: string[]; mono?: boolean }) {
  if (!items.filter(Boolean).length) return null;
  return (
    <div>
      <div className="label-xs mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.filter(Boolean).map((i) => (
          <span
            key={i}
            className={cx('chip border-white/[0.09] bg-white/[0.03] text-slate-300', mono && 'font-mono')}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
