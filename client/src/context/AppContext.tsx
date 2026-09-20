import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DataMode, Investigation } from '../types';
import { api, ApiError } from '../services/api';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  tone: 'info' | 'success' | 'warn' | 'error';
}

interface AppState {
  mode: DataMode;
  setMode: (m: DataMode) => void;
  investigation: Investigation | null;
  setInvestigation: (inv: Investigation | null) => void;
  loadInvestigation: (id: string) => Promise<Investigation | null>;
  online: boolean | null;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Public Source Mode is the default: Demo Data Mode analyzes a fixed
  // built-in subject and ignores whatever context is typed, which is only
  // useful as an offline fallback.
  const [mode, setMode] = useState<DataMode>('public');
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await api.health();
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    check();
    const t = setInterval(check, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const loadInvestigation = useCallback(
    async (id: string) => {
      try {
        const inv = await api.getInvestigation(id);
        setInvestigation(inv);
        return inv;
      } catch (err) {
        pushToast({
          title: 'Could not load investigation',
          message: err instanceof ApiError ? err.message : 'Unknown error.',
          tone: 'error',
        });
        return null;
      }
    },
    [pushToast],
  );

  // Remember the last opened investigation across reloads.
  useEffect(() => {
    const saved = sessionStorage.getItem('dii:last');
    if (saved && !investigation) {
      loadInvestigation(saved).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (investigation?.id) sessionStorage.setItem('dii:last', investigation.id);
  }, [investigation?.id]);

  const value = useMemo<AppState>(
    () => ({
      mode,
      setMode,
      investigation,
      setInvestigation,
      loadInvestigation,
      online,
      toasts,
      pushToast,
      dismissToast,
    }),
    [mode, investigation, online, toasts, pushToast, dismissToast, loadInvestigation],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
