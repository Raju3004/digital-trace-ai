import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Check, CircleSlash, GitCompareArrows, Info, X } from 'lucide-react';
import {
  EmptyState,
  Panel,
  PanelHeader,
  PageHeader,
  SectionTitle,
  Tooltip,
  VerdictTag,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { CorrelationSignal } from '../types';

const STATUS_META = {
  match: { icon: <Check size={12} />, cls: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300', label: 'Match' },
  partial: { icon: <Info size={12} />, cls: 'border-cyan-core/25 bg-cyan-core/[0.08] text-cyan-soft', label: 'Partial' },
  conflict: { icon: <X size={12} />, cls: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300', label: 'Conflict' },
  unavailable: { icon: <CircleSlash size={12} />, cls: 'border-slate-600/30 bg-slate-600/[0.08] text-slate-500', label: 'Unavailable' },
} as const;

function signalColour(s: CorrelationSignal): string {
  if (s.score === null) return '#475569';
  if (s.score >= 0.8) return '#34d399';
  if (s.score >= 0.55) return '#22d3ee';
  if (s.score >= 0.3) return '#fbbf24';
  return '#fb7185';
}

export default function Correlation() {
  const [candidateIdx, setCandidateIdx] = useState(0);

  return (
    <RequireInvestigation>
      {(inv) => {
        if (!inv.candidates.length) {
          return (
            <EmptyState
              title="No candidates to correlate"
              message="Discovery produced no records for this investigation, so there is nothing to compare against the supplied clues."
            />
          );
        }

        const candidate = inv.candidates[Math.min(candidateIdx, inv.candidates.length - 1)];
        const available = candidate.signals.filter((s) => s.score !== null);
        const radarData = available.map((s) => ({
          signal: s.label.replace(' Match', '').replace('Cross-profile Links', 'Cross-links'),
          score: Math.round((s.score ?? 0) * 100),
        }));
        const barData = candidate.signals.map((s) => ({
          name: s.label.replace(' Match', ''),
          score: s.score === null ? 0 : Math.round(s.score * 100),
          weight: s.weight,
          raw: s,
        }));

        const contribution = available
          .map((s) => ({
            label: s.label,
            contribution: (s.score ?? 0) * s.weight,
          }))
          .sort((a, b) => b.contribution - a.contribution);
        const totalContribution = contribution.reduce((sum, c) => sum + c.contribution, 0) || 1;

        return (
          <>
            <PageHeader
              eyebrow="Core intelligence"
              title="Identity Correlation"
              subtitle="Entity resolution across many independent signals. No single signal — least of all a name — is allowed to decide a match on its own."
              actions={
                inv.candidates.length > 1 && (
                  <select
                    className="input w-auto py-2 text-xs"
                    value={candidateIdx}
                    onChange={(e) => setCandidateIdx(Number(e.target.value))}
                  >
                    {inv.candidates.map((c, i) => (
                      <option key={c.id} value={i}>
                        {String(c.rank).padStart(2, '0')} — {c.name} ({Math.round(c.correlationScore * 100)}%)
                      </option>
                    ))}
                  </select>
                )
              }
            />

            {/* Banner */}
            <Panel className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-violet-core/25 bg-violet-core/[0.1]">
                  <GitCompareArrows size={18} className="text-violet-soft" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-slate-100">{candidate.name}</span>
                    <VerdictTag value={candidate.verdict} />
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {available.length} of {candidate.signals.length} signals available ·{' '}
                    {candidate.recordIds.length} correlated record(s)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="label-xs">Prototype correlation score</div>
                <div className="font-mono text-3xl font-semibold tabular-nums text-white">
                  {Math.round(candidate.correlationScore * 100)}%
                </div>
              </div>
            </Panel>

            {/* Signal cards */}
            <SectionTitle hint="hover a card for the exact comparison performed">Correlation Signals</SectionTitle>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {candidate.signals.map((s) => {
                const meta = STATUS_META[s.status];
                return (
                  <Tooltip key={s.key} text={s.detail}>
                    <Panel hover className="w-full p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-300">{s.label}</span>
                        <span className={cx('chip shrink-0', meta.cls)}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span
                          className={cx(
                            'font-mono text-2xl font-semibold tabular-nums',
                            s.score === null ? 'text-slate-600' : 'text-white',
                          )}
                        >
                          {s.score === null ? 'n/a' : `${Math.round(s.score * 100)}%`}
                        </span>
                        <span className="font-mono text-[10px] text-slate-600">w {s.weight.toFixed(2)}</span>
                      </div>
                      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full origin-left rounded-full animate-bar-grow"
                          style={{
                            width: `${s.score === null ? 0 : Math.round(s.score * 100)}%`,
                            background: signalColour(s),
                          }}
                        />
                      </div>
                    </Panel>
                  </Tooltip>
                );
              })}
            </div>

            {/* Charts */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <PanelHeader
                  title="Signal profile"
                  subtitle="Only signals that could actually be evaluated are plotted."
                />
                <div className="h-[320px] p-4">
                  {radarData.length >= 3 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="72%">
                        <PolarGrid stroke="rgba(148,163,184,0.15)" />
                        <PolarAngleAxis
                          dataKey="signal"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                        />
                        <PolarRadiusAxis
                          domain={[0, 100]}
                          tick={{ fill: '#475569', fontSize: 9 }}
                          axisLine={false}
                        />
                        <Radar
                          dataKey="score"
                          stroke="#a78bfa"
                          fill="#8b5cf6"
                          fillOpacity={0.28}
                          strokeWidth={1.6}
                        />
                        <RTooltip
                          contentStyle={{
                            background: '#141824',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: '#e2e8f0' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-[12px] text-slate-500">
                      Fewer than three signals were available — not enough to plot a meaningful profile.
                    </div>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Signal strength"
                  subtitle="Grey bars are signals no source could evaluate."
                />
                <div className="h-[320px] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.08)" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RTooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        contentStyle={{
                          background: '#141824',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                        formatter={(v: any, _n: any, p: any) =>
                          p.payload.raw.score === null ? ['unavailable', 'Signal'] : [`${v}%`, 'Score']
                        }
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={13}>
                        {barData.map((d, i) => (
                          <Cell key={i} fill={signalColour(d.raw)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* Contribution + caveat */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Panel>
                <PanelHeader
                  title="What actually drove this score"
                  subtitle="Each signal's share of the final weighted result."
                />
                <div className="space-y-2.5 p-5">
                  {contribution.map((c) => (
                    <div key={c.label} className="flex items-center gap-3">
                      <span className="w-[150px] shrink-0 truncate text-[12px] text-slate-400">{c.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full origin-left rounded-full bg-gradient-to-r from-violet-core to-cyan-core animate-bar-grow"
                          style={{ width: `${(c.contribution / totalContribution) * 100}%` }}
                        />
                      </div>
                      <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-500">
                        {Math.round((c.contribution / totalContribution) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="border-amber-400/20 bg-amber-400/[0.03]">
                <PanelHeader
                  title="How to read this score"
                  icon={<AlertTriangle size={16} />}
                  subtitle="Read before presenting any number on this page as a result."
                />
                <ul className="space-y-2.5 p-5 text-[12px] leading-relaxed text-slate-400">
                  <li>
                    <strong className="text-slate-200">It is a prototype correlation score</strong>, not a
                    statistical probability. Weights are hand-set and have not been calibrated against
                    ground truth.
                  </li>
                  <li>
                    <strong className="text-slate-200">Unavailable signals are excluded</strong>, not
                    scored as zero. Weights are renormalized over what was actually evaluated.
                  </li>
                  <li>
                    <strong className="text-slate-200">Breadth is penalized when thin.</strong> A candidate
                    supported by fewer than five signals is scaled down, so one strong match cannot carry
                    an identification on its own.
                  </li>
                  <li>
                    <strong className="text-slate-200">No face recognition is performed.</strong> The image
                    signal contributes nothing to this number in the prototype.
                  </li>
                </ul>
              </Panel>
            </div>
          </>
        );
      }}
    </RequireInvestigation>
  );
}
