import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, FolderSearch, Globe, Plus, Search } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  VerdictTag,
  cx,
} from '../components/ui';
import { api, ApiError } from '../services/api';
import { useApp } from '../context/AppContext';
import type { InvestigationSummary } from '../types';

const STATUS_STYLE: Record<string, string> = {
  complete: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  processing: 'border-cyan-core/30 bg-cyan-core/10 text-cyan-soft',
  created: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
  insufficient_evidence: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  failed: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
};

const STATUS_LABEL: Record<string, string> = {
  complete: 'Analysis Complete',
  processing: 'Processing',
  created: 'Not analyzed',
  insufficient_evidence: 'Insufficient evidence',
  failed: 'Failed',
};

export default function Investigations() {
  const [rows, setRows] = useState<InvestigationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { loadInvestigation } = useApp();
  const navigate = useNavigate();

  const load = async () => {
    setError(null);
    try {
      setRows(await api.listInvestigations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unexpected error.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorState title="Could not load investigations" message={error} retry={load} />;
  if (!rows) return <Loading label="Loading investigations" />;

  const filtered = rows.filter(
    (r) =>
      !query.trim() ||
      `${r.label} ${r.subject} ${r.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        eyebrow="Case files"
        title="Investigations"
        subtitle="Every analysis run in this session, with its mode, confidence and source count."
        actions={
          <Link to="/new" className="btn-primary">
            <Plus size={15} />
            New Investigation
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FolderSearch size={20} />}
          title="No investigations yet"
          message="Nothing has been analyzed in this session. Start one to populate the platform."
          action={
            <Link to="/new" className="btn-primary">
              <Plus size={15} />
              Start new investigation
            </Link>
          }
        />
      ) : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input pl-9"
              placeholder="Search by subject, label or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Panel className="overflow-hidden">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-5 py-3 font-semibold">Subject</th>
                    <th className="px-5 py-3 font-semibold">Mode</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Confidence</th>
                    <th className="px-5 py-3 font-semibold">Sources</th>
                    <th className="px-5 py-3 font-semibold">Candidates</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filtered.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-100">{r.subject}</div>
                        <div className="font-mono text-[10px] text-slate-600">{r.id}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cx(
                            'chip',
                            r.mode === 'public'
                              ? 'border-cyan-core/25 bg-cyan-core/10 text-cyan-soft'
                              : 'border-amber-400/25 bg-amber-400/10 text-amber-300',
                          )}
                        >
                          {r.mode === 'public' ? <Globe size={10} /> : <Database size={10} />}
                          {r.mode === 'public' ? 'Public' : 'Demo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cx('chip', STATUS_STYLE[r.status] ?? STATUS_STYLE.created)}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono tabular-nums text-slate-300">
                        {r.confidence === null ? (
                          <span className="text-slate-600">n/a</span>
                        ) : (
                          `${Math.round(r.confidence * 100)}%`
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono tabular-nums text-slate-400">{r.sources}</td>
                      <td className="px-5 py-3.5 font-mono tabular-nums text-slate-400">{r.candidates}</td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(r.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          className="btn-ghost px-3 py-1.5 text-xs"
                          onClick={async () => {
                            const inv = await loadInvestigation(r.id);
                            if (inv) navigate(inv.status === 'created' ? `/processing/${inv.id}` : '/identity');
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-slate-500">
                No investigation matches “{query}”.
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
