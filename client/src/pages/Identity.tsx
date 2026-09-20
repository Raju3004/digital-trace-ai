import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AtSign,
  Building2,
  CalendarRange,
  FileText,
  FolderGit2,
  MapPin,
  ShieldAlert,
  ShieldQuestion,
  UserSearch,
} from 'lucide-react';
import {
  ConfidenceRing,
  Panel,
  PanelHeader,
  PageHeader,
  ProvenanceTag,
  SectionTitle,
  VerdictTag,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';

export default function Identity() {
  return (
    <RequireInvestigation>
      {(inv) => {
        const top = inv.candidates[0];
        const insufficient = !top || top.verdict === 'INSUFFICIENT';

        return (
          <>
            <PageHeader
              eyebrow="Entity resolution"
              title="Identity Overview"
              subtitle="The most likely identity assembled from correlated public records, with every supporting attribute traceable to a source."
              actions={
                <Link to="/correlation" className="btn-ghost">
                  View correlation signals
                  <ArrowRight size={15} />
                </Link>
              }
            />

            {insufficient ? (
              <Panel className="p-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3.5 text-amber-300">
                    <ShieldQuestion size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">
                      Insufficient evidence to establish a reliable identity match
                    </h3>
                    <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-slate-400">
                      The retrieved public sources did not produce a candidate supported by enough
                      independent signals. The system does not assert an identity on this evidence.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <Link to="/candidates" className="btn-ghost">
                      Review all candidates
                    </Link>
                    <Link to="/evidence" className="btn-ghost">
                      Inspect evidence
                    </Link>
                  </div>
                </div>
              </Panel>
            ) : (
              <>
                {/* Headline */}
                <Panel className="mb-6 overflow-hidden">
                  <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
                    <div className="flex items-center gap-5">
                      <div className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-xl border border-violet-core/25 bg-violet-core/[0.08]">
                        <UserSearch size={30} className="text-violet-soft" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-semibold tracking-tight text-white">{top.name}</h2>
                          <VerdictTag value={top.verdict} />
                        </div>
                        {top.aliases.length > 0 && (
                          <p className="mt-1 text-[13px] text-slate-400">
                            Also appears as {top.aliases.join(', ')}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {top.usernames.map((u) => (
                            <span key={u} className="chip border-white/[0.09] bg-white/[0.03] font-mono text-slate-300">
                              <AtSign size={10} className="text-slate-500" />
                              {u}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="md:ml-auto md:flex md:items-center md:gap-6">
                      <div className="hidden text-right md:block">
                        <div className="label-xs">Prototype correlation score</div>
                        <p className="mt-1 max-w-[190px] text-[11px] leading-relaxed text-slate-500">
                          Weighted across {top.signals.filter((s) => s.score !== null).length} available
                          signals. Not a calibrated probability.
                        </p>
                      </div>
                      <ConfidenceRing value={top.correlationScore} size={104} />
                    </div>
                  </div>

                  {inv.conflicts.length > 0 && (
                    <Link
                      to="/conflicts"
                      className="flex items-center gap-2 border-t border-amber-400/20 bg-amber-400/[0.05] px-6 py-3 text-[12px] text-amber-200 transition-colors hover:bg-amber-400/[0.09]"
                    >
                      <ShieldAlert size={14} />
                      {inv.conflicts.length} unresolved conflict
                      {inv.conflicts.length > 1 ? 's' : ''} between sources — review before relying on this profile.
                      <ArrowRight size={13} className="ml-auto" />
                    </Link>
                  )}
                </Panel>

                {/* Attribute grid */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AttrCard
                    icon={<Building2 size={15} />}
                    label="Organization"
                    value={top.organization ?? 'Not established'}
                    sub={top.role ?? undefined}
                  />
                  <AttrCard
                    icon={<MapPin size={15} />}
                    label="Location"
                    value={top.location ?? 'Not established'}
                    sub={inv.conflicts.some((c) => c.field === 'location') ? 'Disputed between sources' : undefined}
                    warn={inv.conflicts.some((c) => c.field === 'location')}
                  />
                  <AttrCard
                    icon={<FolderGit2 size={15} />}
                    label="Projects"
                    value={top.projects.length ? `${top.projects.length} identified` : 'None found'}
                    sub={top.projects.slice(0, 2).join(', ') || undefined}
                  />
                  <AttrCard
                    icon={<CalendarRange size={15} />}
                    label="Public activities"
                    value={top.events.length ? `${top.events.length} listing(s)` : 'None found'}
                    sub={top.events.slice(0, 2).join(', ') || undefined}
                  />
                </div>

                {/* Detail columns */}
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <SectionTitle>Correlated Records</SectionTitle>
                    <Panel className="divide-y divide-white/[0.05]">
                      {inv.records
                        .filter((r) => top.recordIds.includes(r.id))
                        .map((r) => (
                          <a
                            key={r.id}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="block px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-slate-200">{r.title}</div>
                                <div className="mt-0.5 truncate font-mono text-[11px] text-slate-600">{r.url}</div>
                              </div>
                              <ProvenanceTag value={r.provenance} className="shrink-0" />
                            </div>
                          </a>
                        ))}
                    </Panel>
                  </div>

                  <div>
                    <SectionTitle>Information Correlation</SectionTitle>
                    <Panel className="p-5">
                      <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                        How separate public facts chain together into one profile.
                      </p>
                      <div className="space-y-0">
                        {buildChain(top).map((node, i, arr) => (
                          <div key={i} className="relative pl-7">
                            <span
                              className={cx(
                                'absolute left-0 top-1.5 grid h-4 w-4 place-items-center rounded-full border',
                                i === 0
                                  ? 'border-violet-core/50 bg-violet-core/20'
                                  : 'border-white/[0.12] bg-ink-800',
                              )}
                            >
                              <span
                                className={cx(
                                  'h-1.5 w-1.5 rounded-full',
                                  i === 0 ? 'bg-violet-soft' : 'bg-slate-500',
                                )}
                              />
                            </span>
                            {i < arr.length - 1 && (
                              <span className="absolute left-[7.5px] top-6 h-[calc(100%-14px)] w-px bg-white/[0.08]" />
                            )}
                            <div className="pb-4">
                              <div className="label-xs">{node.label}</div>
                              <div className="mt-0.5 text-[13px] text-slate-200">{node.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>

                {/* Discovery chain */}
                {inv.discoveryChain.length > 0 && (
                  <div className="mt-6">
                    <SectionTitle hint="each reliable finding became the clue for the next step">
                      Iterative Discovery Chain
                    </SectionTitle>
                    <Panel>
                      <PanelHeader
                        title="Discovery replay"
                        subtitle="The investigation can be audited step by step rather than taken on trust."
                        icon={<FileText size={16} />}
                      />
                      <div className="scroll-thin flex gap-3 overflow-x-auto p-5">
                        {inv.discoveryChain.map((step) => (
                          <div
                            key={step.id}
                            className="w-[250px] shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-violet-core/30"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span className="grid h-5 w-5 place-items-center rounded-md border border-white/[0.09] font-mono text-[10px] text-violet-soft">
                                {String(step.order).padStart(2, '0')}
                              </span>
                              <span className="label-xs truncate">{step.label}</span>
                            </div>
                            <div className="text-[12px] font-medium leading-snug text-slate-200">
                              {step.discovered}
                            </div>
                            <div className="mt-2 border-t border-white/[0.06] pt-2">
                              <div className="text-[10px] uppercase tracking-wider text-slate-600">Evidence</div>
                              <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-slate-500">
                                {step.evidence}
                              </p>
                            </div>
                            {step.producedClue && (
                              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-cyan-core/[0.07] px-2 py-1.5 text-[11px] text-cyan-soft">
                                <ArrowRight size={11} className="mt-0.5 shrink-0" />
                                {step.producedClue}
                              </div>
                            )}
                            <div className="mt-2 truncate font-mono text-[10px] text-slate-700">{step.source}</div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                )}
              </>
            )}
          </>
        );
      }}
    </RequireInvestigation>
  );
}

function AttrCard({
  icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <Panel hover className="p-4">
      <div className="flex items-center gap-2 text-slate-600">
        {icon}
        <span className="label-xs">{label}</span>
      </div>
      <div className="mt-2.5 text-[15px] font-medium leading-snug text-slate-100">{value}</div>
      {sub && (
        <div className={cx('mt-1 text-[11px] leading-relaxed', warn ? 'text-amber-300' : 'text-slate-500')}>
          {sub}
        </div>
      )}
    </Panel>
  );
}

function buildChain(top: { name: string; organization: string | null; role: string | null; projects: string[]; events: string[]; publications: string[] }) {
  const chain: { label: string; value: string }[] = [{ label: 'Person', value: top.name }];
  if (top.organization) chain.push({ label: 'Organization', value: top.organization });
  if (top.role) chain.push({ label: 'Role', value: top.role });
  if (top.projects[0]) chain.push({ label: 'Project', value: top.projects[0] });
  if (top.events[0]) chain.push({ label: 'Event', value: top.events[0] });
  if (top.publications[0]) chain.push({ label: 'Publication', value: top.publications[0] });
  return chain;
}
