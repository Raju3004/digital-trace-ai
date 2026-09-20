import { ArrowLeftRight, CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react';
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  ProvenanceTag,
  SectionTitle,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';

const STATUS_STYLE: Record<string, string> = {
  Unresolved: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  'Requires verification': 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  Resolved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
};

export default function Conflicts() {
  return (
    <RequireInvestigation>
      {(inv) => (
        <>
          <PageHeader
            eyebrow="Integrity"
            title="Conflict Detection"
            subtitle="When two sources disagree, both values are kept and surfaced. The system never silently discards conflicting information to produce a cleaner answer."
          />

          {inv.conflicts.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={20} />}
              title="No conflicts detected"
              message="Every attribute asserted by more than one source agreed across those sources in this investigation. That is not proof of correctness — only that nothing contradicted itself."
            />
          ) : (
            <div className="space-y-5">
              {inv.conflicts.map((c) => (
                <Panel key={c.id} className="overflow-hidden">
                  <PanelHeader
                    title={c.title}
                    subtitle={c.note}
                    icon={<ShieldAlert size={16} />}
                    actions={
                      <span className={cx('chip shrink-0', STATUS_STYLE[c.status])}>{c.status}</span>
                    }
                  />

                  <div className="grid gap-px bg-white/[0.06] md:grid-cols-[1fr_auto_1fr]">
                    <SourceSide label="Source A" side={c.sourceA} />
                    <div className="flex items-center justify-center bg-ink-900 px-5 py-3 md:px-4">
                      <div className="grid h-9 w-9 place-items-center rounded-full border border-rose-400/30 bg-rose-400/10 text-rose-300">
                        <ArrowLeftRight size={15} />
                      </div>
                    </div>
                    <SourceSide label="Source B" side={c.sourceB} />
                  </div>

                  <div className="border-t border-white/[0.07] bg-white/[0.015] px-5 py-3 text-[11px] leading-relaxed text-slate-500">
                    Field: <span className="font-mono text-slate-400">{c.field}</span> · Both values are
                    carried forward into the intelligence report and neither is treated as authoritative.
                  </div>
                </Panel>
              ))}
            </div>
          )}

          <div className="mt-7">
            <SectionTitle>Why conflicts matter</SectionTitle>
            <Panel className="p-5">
              <div className="grid gap-5 md:grid-cols-3">
                {[
                  {
                    title: 'Silent resolution hides error',
                    body: 'Picking whichever source was read first produces a confident answer with no way to audit it. Keeping both makes the disagreement visible to whoever relies on the result.',
                  },
                  {
                    title: 'Conflicts are signal, not noise',
                    body: 'A location or date that disagrees across sources may mean stale information, a relocation between two dates — or that two different people have been merged into one profile.',
                  },
                  {
                    title: 'The score reflects it',
                    body: 'A conflicting signal scores as a conflict rather than being dropped, so a candidate with contradictory attributes cannot reach a high correlation score.',
                  },
                ].map((b) => (
                  <div key={b.title}>
                    <h4 className="text-[13px] font-semibold text-slate-200">{b.title}</h4>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{b.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </RequireInvestigation>
  );
}

function SourceSide({
  label,
  side,
}: {
  label: string;
  side: { source: string; url: string; value: string; provenance: any };
}) {
  return (
    <div className="bg-ink-900 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="label-xs">{label}</span>
        <ProvenanceTag value={side.provenance} />
      </div>
      <div className="mt-3 text-xl font-semibold text-white">{side.value}</div>
      <div className="mt-2 text-[12px] text-slate-400">{side.source}</div>
      <a
        href={side.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-1.5 inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-slate-500 hover:text-cyan-soft"
      >
        <ExternalLink size={10} className="shrink-0" />
        {side.url}
      </a>
    </div>
  );
}
