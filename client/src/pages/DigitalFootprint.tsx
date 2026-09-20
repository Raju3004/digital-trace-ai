import { useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  CalendarRange,
  ExternalLink,
  FolderGit2,
  Globe2,
  Search,
  UserCircle2,
} from 'lucide-react';
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  ProvenanceTag,
  ReliabilityTag,
  SectionTitle,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { NormalizedRecord, SourceType } from '../types';

const GROUPS: {
  key: string;
  title: string;
  icon: typeof UserCircle2;
  types: SourceType[];
  blurb: string;
}[] = [
  {
    key: 'profiles',
    title: 'Public Profiles',
    icon: UserCircle2,
    types: ['public_profile', 'personal_website'],
    blurb: 'Profile pages and self-published sites.',
  },
  {
    key: 'professional',
    title: 'Professional',
    icon: Building2,
    types: ['official_organization'],
    blurb: 'Organizations, roles and education stated on official pages.',
  },
  {
    key: 'activities',
    title: 'Public Activities',
    icon: CalendarRange,
    types: ['event_listing'],
    blurb: 'Conferences, hackathons, workshops and other public listings.',
  },
  {
    key: 'technical',
    title: 'Technical Contributions',
    icon: FolderGit2,
    types: ['public_repository', 'publication'],
    blurb: 'Repositories, projects, publications and patents.',
  },
];

export default function DigitalFootprint() {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [onlyCorrelated, setOnlyCorrelated] = useState(true);

  return (
    <RequireInvestigation>
      {(inv) => {
        const top = inv.candidates[0];
        const correlatedIds = new Set(top?.recordIds ?? []);

        const pool = inv.records.filter((r) => {
          if (onlyCorrelated && correlatedIds.size && !correlatedIds.has(r.id)) return false;
          if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
          if (!query.trim()) return true;
          const hay = `${r.title} ${r.source} ${r.url} ${r.person ?? ''} ${r.projects.join(' ')} ${r.events.join(' ')}`;
          return hay.toLowerCase().includes(query.trim().toLowerCase());
        });

        const sources = [...new Set(inv.records.map((r) => r.source))];

        return (
          <>
            <PageHeader
              eyebrow="Discovered surface"
              title="Digital Footprint"
              subtitle="Everything retrieved for this subject, grouped by the kind of public source it came from. Each row keeps its URL, evidence and provenance."
            />

            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  className="input pl-9"
                  placeholder="Search the footprint…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
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
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.09] bg-ink-950/50 px-3.5 py-2.5 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={onlyCorrelated}
                  onChange={(e) => setOnlyCorrelated(e.target.checked)}
                  className="accent-violet-core"
                />
                Only records correlated to the top candidate
              </label>
              <span className="text-[11px] text-slate-500">
                {pool.length} of {inv.records.length} records
              </span>
            </div>

            {pool.length === 0 ? (
              <EmptyState
                title="Nothing matches the current filters"
                message="Clear the search or widen the source filter to see the full discovered footprint."
                action={
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setQuery('');
                      setSourceFilter('all');
                      setOnlyCorrelated(false);
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className="space-y-7">
                {GROUPS.map((g) => {
                  const rows = pool.filter((r) => g.types.includes(r.sourceType));
                  if (!rows.length) return null;
                  return (
                    <div key={g.key}>
                      <SectionTitle hint={g.blurb}>{g.title}</SectionTitle>
                      <Panel className="overflow-hidden">
                        <div className="divide-y divide-white/[0.05]">
                          {rows.map((r) => (
                            <FootprintRow key={r.id} record={r} />
                          ))}
                        </div>
                      </Panel>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      }}
    </RequireInvestigation>
  );
}

function FootprintRow({ record }: { record: NormalizedRecord }) {
  const facts = useMemo(() => {
    const out: { label: string; values: string[] }[] = [];
    if (record.organizations.length) out.push({ label: 'Organizations', values: record.organizations });
    if (record.roles.length) out.push({ label: 'Roles', values: record.roles });
    if (record.projects.length) out.push({ label: 'Projects', values: record.projects.slice(0, 5) });
    if (record.events.length) out.push({ label: 'Events', values: record.events });
    if (record.publications.length) out.push({ label: 'Publications', values: record.publications });
    if (record.usernames.length) out.push({ label: 'Handles', values: record.usernames });
    if (record.locations.length) out.push({ label: 'Locations', values: record.locations });
    return out;
  }, [record]);

  return (
    <div className="px-5 py-4 transition-colors hover:bg-white/[0.015]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-slate-100">{record.title}</span>
            <span className="chip border-white/[0.09] bg-white/[0.03] text-slate-400">{record.source}</span>
          </div>
          <a
            href={record.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500 hover:text-cyan-soft"
          >
            <ExternalLink size={10} />
            <span className="truncate">{record.url}</span>
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ReliabilityTag value={record.reliability} />
          <ProvenanceTag value={record.provenance} />
        </div>
      </div>

      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <div className="label-xs mb-1">{f.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {f.values.map((v) => (
                  <span key={v} className="chip border-white/[0.07] bg-white/[0.02] text-slate-300">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {record.rawEvidence[0] && (
        <p className="mt-3 border-l-2 border-white/[0.08] pl-3 text-[11px] leading-relaxed text-slate-500">
          <span className="text-slate-600">{record.rawEvidence[0].label}: </span>
          {record.rawEvidence[0].excerpt}
        </p>
      )}
    </div>
  );
}
