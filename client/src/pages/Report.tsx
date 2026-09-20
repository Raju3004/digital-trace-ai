import { useMemo } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderGit2,
  Lock,
  Printer,
  ShieldQuestion,
  UserSearch,
} from 'lucide-react';
import {
  ConfidenceRing,
  EmptyState,
  Panel,
  PanelHeader,
  PageHeader,
  ProvenanceTag,
  SectionTitle,
  VerdictTag,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { IntelligenceReport } from '../types';

export default function Report() {
  return (
    <RequireInvestigation>
      {(inv) => {
        const report = inv.report;
        if (!report) {
          return (
            <EmptyState
              title="No report generated"
              message="This investigation has not produced a report yet. Run the analysis to generate one."
            />
          );
        }
        return <ReportBody inv={inv} report={report} />;
      }}
    </RequireInvestigation>
  );
}

function ReportBody({ inv, report }: { inv: any; report: IntelligenceReport }) {
  const insufficient = report.mostLikelyIdentity.verdict === 'NONE';

  const statusCounts = useMemo(
    () => Object.entries(report.evidenceSummary.byStatus).sort((a, b) => b[1] - a[1]),
    [report],
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Deliverable"
          title="Digital Identity Intelligence Report"
          subtitle={`Generated ${new Date(report.generatedAt).toLocaleString('en-GB')} · case ${inv.id}`}
          actions={
            <button className="btn-primary" onClick={() => window.print()}>
              <Printer size={15} />
              Export Report
            </button>
          }
        />
      </div>

      <div className="space-y-6">
        {/* Authorization banner */}
        <Panel
          className={cx(
            'p-4',
            inv.mode === 'demo'
              ? 'border-amber-400/25 bg-amber-400/[0.05]'
              : 'border-cyan-core/25 bg-cyan-core/[0.05]',
          )}
        >
          <div className="flex items-start gap-3">
            <Lock size={15} className={cx('mt-0.5 shrink-0', inv.mode === 'demo' ? 'text-amber-300' : 'text-cyan-soft')} />
            <div>
              <div className="label-xs mb-1">Data Authorization</div>
              <p className="print-text text-[12px] leading-relaxed text-slate-300">
                {report.dataAuthorization}
              </p>
            </div>
          </div>
        </Panel>

        {/* Executive summary */}
        <Panel>
          <PanelHeader title="Executive Summary" icon={<FileText size={16} />} />
          <div className="p-5">
            <p className="print-text text-[13px] leading-relaxed text-slate-300">{report.executiveSummary}</p>
          </div>
        </Panel>

        {/* Most likely identity */}
        <Panel>
          <PanelHeader
            title="Most Likely Identity"
            icon={insufficient ? <ShieldQuestion size={16} /> : <UserSearch size={16} />}
          />
          <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
            <ConfidenceRing value={report.confidence} size={96} />
            <div className="min-w-0 flex-1">
              {insufficient ? (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="print-text text-lg font-semibold text-slate-100">
                      No reliable identity established
                    </h3>
                    <VerdictTag value="NONE" />
                  </div>
                  <p className="print-text mt-2 text-[13px] leading-relaxed text-slate-400">
                    {report.mostLikelyIdentity.statement}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="print-text text-lg font-semibold text-white">
                      {report.mostLikelyIdentity.name}
                    </h3>
                    <VerdictTag value={report.mostLikelyIdentity.verdict} />
                  </div>
                  <p className="print-text mt-2 text-[12px] text-slate-400">
                    {report.mostLikelyIdentity.statement}
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ListBlock label="Name Variations" items={report.nameVariations} />
                    <ListBlock label="Known Usernames" items={report.knownUsernames} mono />
                  </div>
                </>
              )}
            </div>
          </div>
        </Panel>

        {/* Profiles / affiliations */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Public Profiles" subtitle={`${report.publicProfiles.length} retrieved`} />
            <div className="divide-y divide-white/[0.05]">
              {report.publicProfiles.length === 0 ? (
                <Empty text="No public profile was retrieved." />
              ) : (
                report.publicProfiles.map((p) => (
                  <div key={p.url} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="print-text text-[13px] text-slate-200">{p.platform}</div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-0.5 inline-flex items-center gap-1.5 truncate font-mono text-[11px] text-slate-500 hover:text-cyan-soft"
                      >
                        <ExternalLink size={10} className="shrink-0" />
                        {p.url}
                      </a>
                    </div>
                    <ProvenanceTag value={p.provenance} />
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Professional Affiliations"
              subtitle={`${report.professionalAffiliations.length} organization(s)`}
              icon={<Building2 size={16} />}
            />
            <div className="divide-y divide-white/[0.05]">
              {report.professionalAffiliations.length === 0 ? (
                <Empty text="No affiliation could be established from public sources." />
              ) : (
                report.professionalAffiliations.map((a) => (
                  <div key={a.organization} className="px-5 py-3">
                    <div className="print-text text-[13px] text-slate-200">{a.organization}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {a.role ?? 'Role not stated'} · stated by {a.source}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Activities / projects / publications */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel>
            <PanelHeader title="Public Activities" icon={<CalendarRange size={16} />} />
            <div className="divide-y divide-white/[0.05]">
              {report.publicActivities.length === 0 ? (
                <Empty text="No public activity found." />
              ) : (
                report.publicActivities.map((a, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="print-text text-[13px] text-slate-200">{a.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {a.type} · {a.source}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Projects & Contributions" icon={<FolderGit2 size={16} />} />
            <div className="scroll-thin max-h-[260px] divide-y divide-white/[0.05] overflow-y-auto">
              {report.projects.length === 0 ? (
                <Empty text="No project reference found." />
              ) : (
                report.projects.map((p, i) => (
                  <div key={i} className="px-5 py-2.5">
                    <div className="print-text text-[12px] text-slate-200">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{p.source}</div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Publications / Patents" icon={<FileText size={16} />} />
            <div className="divide-y divide-white/[0.05]">
              {report.publications.length === 0 ? (
                <Empty text="No publication found." />
              ) : (
                report.publications.map((p, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="print-text text-[12px] leading-snug text-slate-200">{p.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{p.source}</div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Timeline + graph summary */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Timeline" subtitle={`${inv.timeline.length} dated entr(ies)`} />
            <div className="scroll-thin max-h-[280px] divide-y divide-white/[0.05] overflow-y-auto">
              {inv.timeline.length === 0 ? (
                <Empty text="No dated activity could be attributed." />
              ) : (
                inv.timeline.map((t: any) => (
                  <div key={t.id} className="flex items-baseline gap-4 px-5 py-2.5">
                    <span className="w-20 shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
                      {t.precision === 'year' ? t.date : t.date}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="print-text truncate text-[12px] text-slate-200">{t.activity}</div>
                      <div className="truncate text-[11px] text-slate-600">{t.source}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Relationship Graph Summary"
              subtitle={`${inv.graph.nodes.length} node(s), ${inv.graph.edges.length} edge(s)`}
            />
            <div className="scroll-thin max-h-[280px] divide-y divide-white/[0.05] overflow-y-auto">
              {inv.graph.edges.length === 0 ? (
                <Empty text="No relationship established." />
              ) : (
                inv.graph.edges.map((e: any) => {
                  const target = inv.graph.nodes.find((n: any) => n.id === e.target);
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <span className="print-text truncate text-[12px] text-slate-300">
                        <span className="text-slate-500">{e.label} </span>
                        {target?.label}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
                        {e.confidence === null || e.confidence === undefined
                          ? 'n/a'
                          : `${Math.round(e.confidence * 100)}%`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </div>

        {/* Evidence summary */}
        <Panel>
          <PanelHeader
            title="Evidence Summary"
            subtitle={`${report.evidenceSummary.total} finding(s) recorded with provenance`}
            icon={<CheckCircle2 size={16} />}
          />
          <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
            {statusCounts.map(([status, count]) => (
              <div key={status} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="label-xs">{status}</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-white">{count}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Conflicts */}
        <Panel className={report.conflicts.length ? 'border-amber-400/20' : undefined}>
          <PanelHeader
            title="Conflicts"
            subtitle={
              report.conflicts.length
                ? 'Both values are retained. Neither is treated as authoritative.'
                : 'No contradiction was detected between sources.'
            }
            icon={<AlertTriangle size={16} />}
          />
          <div className="divide-y divide-white/[0.05]">
            {report.conflicts.length === 0 ? (
              <Empty text="No conflicts detected." />
            ) : (
              report.conflicts.map((c) => (
                <div key={c.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="print-text text-[13px] font-medium text-slate-200">{c.title}</span>
                    <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-300">{c.status}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                      <div className="label-xs">{c.sourceA.source}</div>
                      <div className="print-text mt-0.5 text-[13px] text-slate-200">{c.sourceA.value}</div>
                    </div>
                    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                      <div className="label-xs">{c.sourceB.source}</div>
                      <div className="print-text mt-0.5 text-[13px] text-slate-200">{c.sourceB.value}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{c.note}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Uncertainty */}
        <Panel className="border-white/[0.1]">
          <PanelHeader
            title="Uncertainty & Limitations"
            subtitle="Read this before acting on anything above."
            icon={<ShieldQuestion size={16} />}
          />
          <ul className="space-y-2.5 p-5">
            {report.uncertainty.map((u, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                <span className="print-text text-[12px] leading-relaxed text-slate-400">{u}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function ListBlock({ label, items, mono }: { label: string; items: string[]; mono?: boolean }) {
  return (
    <div>
      <div className="label-xs mb-1.5">{label}</div>
      {items.length === 0 ? (
        <span className="text-[12px] text-slate-600">None established.</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <span
              key={i}
              className={cx('chip border-white/[0.09] bg-white/[0.03] text-slate-300', mono && 'font-mono')}
            >
              {i}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-6 text-center text-[12px] text-slate-600">{text}</div>;
}
