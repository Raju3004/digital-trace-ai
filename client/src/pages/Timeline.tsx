import { useState } from 'react';
import { CalendarClock, ExternalLink, Info } from 'lucide-react';
import {
  EmptyState,
  PageHeader,
  Panel,
  ProvenanceTag,
  SectionTitle,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { TimelineEntry } from '../types';

function displayDate(e: TimelineEntry): string {
  if (e.precision === 'year') return e.date;
  const d = new Date(e.precision === 'month' ? `${e.date}-01` : e.date);
  if (Number.isNaN(d.getTime())) return e.date;
  return e.precision === 'month'
    ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Timeline() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <RequireInvestigation>
      {(inv) => {
        const byYear = inv.timeline.reduce<Record<string, TimelineEntry[]>>((acc, e) => {
          const year = e.date.slice(0, 4);
          (acc[year] ??= []).push(e);
          return acc;
        }, {});
        const years = Object.keys(byYear).sort();

        return (
          <>
            <PageHeader
              eyebrow="Chronology"
              title="Timeline"
              subtitle="Only dates that actually appear in a retrieved source are placed here. Where a source states a year alone, the entry stays at year precision — no exact date is invented."
            />

            {inv.timeline.length === 0 ? (
              <EmptyState
                icon={<CalendarClock size={20} />}
                title="No dated activity found"
                message="None of the retrieved sources stated a date that could be attributed to this subject."
              />
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-3">
                  <div className="flex items-center gap-2 text-[12px] text-slate-400">
                    <Info size={13} className="text-slate-600" />
                    {inv.timeline.length} dated entr{inv.timeline.length === 1 ? 'y' : 'ies'} across{' '}
                    {years.length} year{years.length === 1 ? '' : 's'}
                  </div>
                  <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> day precision
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-core" /> month
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400" /> year only
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-[74px] top-2 hidden h-[calc(100%-16px)] w-px bg-gradient-to-b from-violet-core/40 via-white/[0.08] to-transparent sm:block" />

                  <div className="space-y-8">
                    {years.map((year) => (
                      <div key={year}>
                        <div className="mb-3 flex items-center gap-4">
                          <span className="w-[60px] shrink-0 text-right font-mono text-xl font-semibold tabular-nums text-white">
                            {year}
                          </span>
                          <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-violet-core/40 bg-ink-900">
                            <span className="h-2 w-2 rounded-full bg-violet-soft" />
                          </span>
                          <span className="h-px flex-1 bg-white/[0.06]" />
                          <span className="label-xs">{byYear[year].length} entr{byYear[year].length === 1 ? 'y' : 'ies'}</span>
                        </div>

                        <div className="space-y-2.5 sm:pl-[102px]">
                          {byYear[year].map((e) => {
                            const open = selected === e.id;
                            return (
                              <Panel
                                key={e.id}
                                hover
                                className={cx(
                                  'cursor-pointer p-4 transition-all',
                                  open && 'border-violet-core/40 bg-violet-core/[0.05]',
                                )}
                                >
                                <div onClick={() => setSelected(open ? null : e.id)}>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={cx(
                                            'h-2 w-2 shrink-0 rounded-full',
                                            e.precision === 'day'
                                              ? 'bg-emerald-400'
                                              : e.precision === 'month'
                                                ? 'bg-cyan-core'
                                                : 'bg-amber-400',
                                          )}
                                        />
                                        <span className="font-mono text-[11px] text-slate-500">
                                          {displayDate(e)}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 text-[13px] font-medium text-slate-100">
                                        {e.activity}
                                      </div>
                                      {e.organization && (
                                        <div className="mt-0.5 text-[12px] text-slate-500">{e.organization}</div>
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <ProvenanceTag value={e.provenance} />
                                      <span className="font-mono text-[12px] tabular-nums text-slate-300">
                                        {e.confidence === null ? 'n/a' : `${Math.round(e.confidence * 100)}%`}
                                      </span>
                                    </div>
                                  </div>

                                  {open && (
                                    <div className="mt-3.5 space-y-2.5 border-t border-white/[0.07] pt-3.5 animate-fade-in">
                                      <div>
                                        <div className="label-xs mb-1">Evidence</div>
                                        <p className="border-l-2 border-violet-core/40 pl-3 text-[12px] leading-relaxed text-slate-400">
                                          {e.evidence}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span className="text-[11px] text-slate-500">Source: {e.source}</span>
                                        <a
                                          href={e.url}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          onClick={(ev) => ev.stopPropagation()}
                                          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cyan-soft hover:underline"
                                        >
                                          <ExternalLink size={10} />
                                          Open source
                                        </a>
                                      </div>
                                      {e.precision === 'year' && (
                                        <div className="rounded-md border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[11px] text-amber-200/90">
                                          The source states a year only. No month or day has been inferred.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Panel>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        );
      }}
    </RequireInvestigation>
  );
}
