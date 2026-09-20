import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Database, Globe, Info, Menu, ShieldCheck, X, XCircle } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { cx } from '../ui';
import { useApp } from '../../context/AppContext';

function ModeToggle() {
  const { mode, setMode, pushToast } = useApp();
  return (
    <div className="flex items-center rounded-lg border border-white/[0.09] bg-ink-950/50 p-0.5">
      {(
        [
          { id: 'public' as const, label: 'Public Source Mode', icon: Globe },
          { id: 'demo' as const, label: 'Demo Data Mode', icon: Database },
        ]
      ).map((opt) => (
        <button
          key={opt.id}
          onClick={() => {
            setMode(opt.id);
            pushToast({
              title: opt.id === 'public' ? 'Public Source Mode' : 'Demo Data Mode',
              message:
                opt.id === 'public'
                  ? 'New analyses will retrieve permitted public pages from allowlisted domains only.'
                  : 'New analyses will use the local synthetic fixture. No website will be contacted.',
              tone: 'info',
            });
          }}
          className={cx(
            'flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
            mode === opt.id
              ? opt.id === 'public'
                ? 'bg-cyan-core/15 text-cyan-soft shadow-glow-cyan'
                : 'bg-amber-400/15 text-amber-300'
              : 'text-slate-500 hover:text-slate-300',
          )}
          title={opt.label}
        >
          <opt.icon size={13} />
          <span className="hidden lg:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useApp();
  const icons = {
    info: <Info size={15} className="text-cyan-soft" />,
    success: <CheckCircle2 size={15} className="text-emerald-400" />,
    warn: <AlertTriangle size={15} className="text-amber-300" />,
    error: <XCircle size={15} className="text-rose-400" />,
  };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[360px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="panel pointer-events-auto flex items-start gap-3 p-3.5 animate-fade-up"
          role="status"
        >
          <div className="mt-0.5">{icons[t.tone]}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-slate-100">{t.title}</div>
            {t.message && <div className="mt-1 text-[11px] leading-relaxed text-slate-400">{t.message}</div>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="rounded p-0.5 text-slate-600 hover:bg-white/5 hover:text-slate-300"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { mode, online } = useApp();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <div className="relative animate-fade-in" onClick={() => setMobileNav(false)}>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-[62px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.07] bg-ink-900/50 px-4 backdrop-blur-xl md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 md:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <Link to="/" className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-slate-200">
              <ShieldCheck size={15} className="text-violet-soft" />
              <span className="hidden sm:inline">Authorized public-source analysis</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cx(
                'hidden items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider sm:flex',
                online === false ? 'text-rose-400' : 'text-slate-500',
              )}
            >
              {online === false && 'API OFFLINE'}
            </span>
            <ModeToggle />
          </div>
        </header>

        {/* Mode banner */}
        <div
          className={cx(
            'flex shrink-0 items-center gap-2 border-b px-4 py-1.5 text-[11px] md:px-6',
            mode === 'public'
              ? 'border-cyan-core/20 bg-cyan-core/[0.05] text-cyan-soft/90'
              : 'border-amber-400/20 bg-amber-400/[0.05] text-amber-300/90',
          )}
        >
          {mode === 'public' ? <Globe size={12} /> : <Database size={12} />}
          <span>
            {mode === 'public'
              ? 'Public Source Mode — only allowlisted domains permitting automated access are retrieved, subject to robots.txt, rate limits and path restrictions.'
              : 'Demo Data Mode — results come from a local synthetic fixture. No website is contacted and no result describes a real person.'}
          </span>
        </div>

        <main className="scroll-thin flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>

      <Toasts />
    </div>
  );
}
