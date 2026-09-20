import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Info,
  Loader2,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import type { EvidenceStatus, Provenance, Reliability } from '../../types';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Panel */

export function Panel({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cx('panel', hover && 'panel-hover', className)}>{children}</div>;
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-violet-soft">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

/* --------------------------------------------------------------- Page head */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        {eyebrow && <div className="label-xs mb-2 text-violet-soft/80">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Provenance */

const PROVENANCE_STYLE: Record<Provenance, { label: string; cls: string }> = {
  PUBLIC_SOURCE: {
    label: 'PUBLIC SOURCE',
    cls: 'border-cyan-core/30 bg-cyan-core/10 text-cyan-soft',
  },
  ORGANIZER_PROVIDED: {
    label: 'ORGANIZER PROVIDED',
    cls: 'border-violet-core/30 bg-violet-core/10 text-violet-soft',
  },
  DEMO_DATA: {
    label: 'DEMO DATA',
    cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  },
};

export function ProvenanceTag({ value, className }: { value: Provenance; className?: string }) {
  const s = PROVENANCE_STYLE[value] ?? PROVENANCE_STYLE.DEMO_DATA;
  return (
    <span className={cx('chip font-mono tracking-wide', s.cls, className)} title="Data origin">
      {s.label}
    </span>
  );
}

/* --------------------------------------------------------------- Statuses */

const STATUS_STYLE: Record<EvidenceStatus, { cls: string; icon: ReactNode }> = {
  Verified: {
    cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    icon: <CheckCircle2 size={12} />,
  },
  Supported: {
    cls: 'border-cyan-core/30 bg-cyan-core/10 text-cyan-soft',
    icon: <CheckCircle2 size={12} />,
  },
  Uncertain: {
    cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    icon: <AlertTriangle size={12} />,
  },
  Conflict: {
    cls: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    icon: <ShieldAlert size={12} />,
  },
  Unavailable: {
    cls: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    icon: <CircleSlash size={12} />,
  },
};

export function StatusTag({ value }: { value: EvidenceStatus }) {
  const s = STATUS_STYLE[value];
  return (
    <span className={cx('chip', s.cls)}>
      {s.icon}
      {value}
    </span>
  );
}

export function ReliabilityTag({ value }: { value: Reliability }) {
  const map: Record<Reliability, string> = {
    High: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    'Medium-High': 'border-cyan-core/25 bg-cyan-core/10 text-cyan-soft',
    Medium: 'border-slate-400/25 bg-slate-400/10 text-slate-300',
    'Low-Medium': 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    Low: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  };
  return <span className={cx('chip', map[value])}>{value}</span>;
}

export function VerdictTag({ value }: { value: string }) {
  const map: Record<string, string> = {
    STRONG: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    PROBABLE: 'border-cyan-core/30 bg-cyan-core/10 text-cyan-soft',
    WEAK: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    INSUFFICIENT: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    NONE: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
  };
  return <span className={cx('chip font-mono tracking-wide', map[value] ?? map.NONE)}>{value}</span>;
}

/* ------------------------------------------------------------- Confidence */

export function confidenceColor(v: number | null): string {
  if (v === null) return 'bg-slate-600';
  if (v >= 0.8) return 'bg-emerald-400';
  if (v >= 0.55) return 'bg-cyan-core';
  if (v >= 0.3) return 'bg-amber-400';
  return 'bg-rose-400';
}

export function ConfidenceBar({
  value,
  label,
  compact,
}: {
  value: number | null;
  label?: string;
  compact?: boolean;
}) {
  const pctValue = value === null ? 0 : Math.round(value * 100);
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        {label && <span className="text-xs text-slate-400">{label}</span>}
        <span
          className={cx(
            'font-mono tabular-nums',
            compact ? 'text-xs' : 'text-sm',
            value === null ? 'text-slate-500' : 'text-slate-200',
          )}
        >
          {value === null ? 'n/a' : `${pctValue}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cx('h-full origin-left rounded-full animate-bar-grow', confidenceColor(value))}
          style={{ width: `${pctValue}%` }}
        />
      </div>
    </div>
  );
}

export function ConfidenceRing({ value, size = 92 }: { value: number | null; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const dash = c * v;
  const colour =
    value === null
      ? '#475569'
      : v >= 0.8
        ? '#34d399'
        : v >= 0.55
          ? '#22d3ee'
          : v >= 0.3
            ? '#fbbf24'
            : '#fb7185';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-semibold tabular-nums text-white">
          {value === null ? 'n/a' : `${Math.round(v * 100)}%`}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */

export function Metric({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'violet' | 'cyan' | 'warn';
}) {
  const ring =
    tone === 'violet'
      ? 'from-violet-core/20'
      : tone === 'cyan'
        ? 'from-cyan-core/20'
        : tone === 'warn'
          ? 'from-amber-400/20'
          : 'from-white/[0.06]';
  return (
    <Panel hover className="relative overflow-hidden p-5">
      <div className={cx('pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r to-transparent', ring)} />
      <div className="flex items-start justify-between">
        <div className="label-xs">{label}</div>
        {icon && <div className="text-slate-600">{icon}</div>}
      </div>
      <div className="mt-3 font-mono text-[28px] font-semibold leading-none tabular-nums text-white">
        {value}
      </div>
      {hint && <div className="mt-2 text-[11px] leading-relaxed text-slate-500">{hint}</div>}
    </Panel>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-slate-600">
        {icon ?? <Info size={20} />}
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}

export function ErrorState({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return (
    <Panel className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-rose-300">
        <XCircle size={20} />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">{message}</p>
      {retry && (
        <button className="btn-ghost mt-5" onClick={retry}>
          Retry
        </button>
      )}
    </Panel>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin text-violet-soft" />
      {label}…
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'rounded-md bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-[280px]
                   -translate-x-1/2 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-[11px]
                   leading-relaxed text-slate-300 shadow-panel group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

export function Expandable({
  header,
  children,
  defaultOpen,
}: {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          size={15}
          className={cx(
            'mt-0.5 shrink-0 text-slate-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        <div className="min-w-0 flex-1">{header}</div>
      </button>
      {open && <div className="mt-3 pl-[27px] animate-fade-in">{children}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (!ref.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div ref={ref} className={cx('panel w-full animate-fade-up', width)}>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="scroll-thin max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-xs mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-slate-600">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{children}</h2>
      {hint && <span className="text-[11px] text-slate-600">{hint}</span>}
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}
