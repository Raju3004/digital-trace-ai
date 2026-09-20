import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  FileText,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Network,
  Plus,
  ScanSearch,
  ShieldCheck,
  Users,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { cx } from '../ui';
import { useApp } from '../../context/AppContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/new', label: 'New Investigation', icon: Plus },
  { to: '/investigations', label: 'Investigations', icon: ListChecks },
  { divider: 'ANALYSIS' as const },
  { to: '/identity', label: 'Identity', icon: Fingerprint },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/correlation', label: 'Correlation', icon: GitBranch },
  { to: '/footprint', label: 'Digital Footprint', icon: ScanSearch },
  { divider: 'VERIFICATION' as const },
  { to: '/evidence', label: 'Evidence', icon: ShieldCheck },
  { to: '/conflicts', label: 'Conflicts', icon: AlertTriangle },
  { to: '/graph', label: 'Relationship Graph', icon: Network },
  { to: '/timeline', label: 'Timeline', icon: Clock },
  { to: '/report', label: 'Reports', icon: FileText },
];

export function Sidebar() {
  const { online, investigation } = useApp();
  const location = useLocation();

  return (
    <aside className="relative z-10 flex h-full w-[248px] shrink-0 flex-col border-r border-white/[0.07] bg-ink-900/60 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-[18px]">
        <div className="relative grid h-9 w-9 place-items-center rounded-lg border border-violet-core/30 bg-violet-core/10">
          <Fingerprint size={18} className="text-violet-soft" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight text-white">
            Digital Identity
          </div>
          <div className="truncate text-[11px] leading-tight text-slate-500">Intelligence Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((item, i) =>
          'divider' in item ? (
            <div key={`d${i}`} className="px-3 pb-2 pt-5 text-[10px] font-semibold tracking-[0.16em] text-slate-600">
              {item.divider}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150',
                  isActive
                    ? 'bg-violet-core/[0.13] text-white shadow-[inset_2px_0_0_0_rgba(167,139,250,0.9)]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                )
              }
            >
              <item.icon
                size={16}
                className={cx(
                  'shrink-0 transition-colors',
                  location.pathname === item.to ? 'text-violet-soft' : 'text-slate-500 group-hover:text-slate-300',
                )}
              />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ),
        )}
      </nav>

      {/* Footer status */}
      <div className="space-y-3 border-t border-white/[0.07] px-4 py-4">
        {investigation && (
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
            <div className="label-xs mb-1">Active case</div>
            <div className="truncate text-[11px] text-slate-300">{investigation.label}</div>
            <div className="mt-1 font-mono text-[10px] text-slate-600">{investigation.id}</div>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.1em] text-emerald-300">
            AUTHORIZED DATA MODE
          </span>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="label-xs">System Status</span>
          <span
            className={cx(
              'flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider',
              online === null ? 'text-slate-500' : online ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            <Activity size={11} />
            {online === null ? 'CHECKING' : online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </aside>
  );
}
