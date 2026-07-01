import { Moon, Sun, Users, RefreshCw, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import SyncButton from '@/components/sync/SyncButton';
import { api } from '@/lib/api';

function fmtSyncTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function Header() {
  const { tab, setTab, toggleTheme, theme } = useAppStore();
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  // Shares cache with SyncButton — no extra network request
  const { data: syncStatus } = useQuery({ queryKey: ['sync-status'], queryFn: api.syncStatus, refetchInterval: (q) => q.state.data?.syncing ? 5_000 : 30_000 });
  const lastSyncAt = syncStatus?.lastResult?.at ?? null;

  useEffect(() => {
    let cancelled = false;

    // Local date in YYYY-MM-DD so count resets at local midnight, not UTC midnight
    const localDate = new Date().toLocaleDateString('en-CA');

    // Retrieve or generate a UUID session ID (persists for this browser tab's lifetime)
    let sessionId = sessionStorage.getItem('visitSessionId');
    if (!sessionId) {
      try { sessionId = crypto.randomUUID(); }
      catch { sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      sessionStorage.setItem('visitSessionId', sessionId);
      // New session: ping to register this visit
      api.pingVisitor(localDate, sessionId)
        .then(d => { if (!cancelled) setVisitorCount(d.count); })
        .catch(() => {});
    } else {
      // Existing session (e.g. page refresh): just read the current count, no extra ping
      api.todayVisitors(localDate)
        .then(d => { if (!cancelled) setVisitorCount(d.count); })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top bar */}
      <div className="h-14 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center px-6 gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/kioti-logo.png" alt="KIOTI" className="h-8 w-auto object-contain" />
          <span className="text-white font-semibold text-base tracking-tight">
            Case <span className="text-amber-400">Dashboard</span>
          </span>
        </div>

        <div className="flex-1" />

        {visitorCount !== null && (
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Users size={12} />
            <span>Today <span className="text-slate-200 font-medium">{visitorCount.toLocaleString()}</span></span>
          </div>
        )}

        {lastSyncAt && (
          <div className="hidden sm:flex items-center gap-1 text-slate-400 text-xs">
            <RefreshCw size={11} />
            <span>Synced <span className="text-slate-300">{fmtSyncTime(lastSyncAt)}</span></span>
          </div>
        )}

        <SyncButton />

        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Confidential notice */}
      <div className="h-6 bg-amber-500/10 border-y border-amber-500/20 flex items-center justify-center gap-1.5 px-4">
        <Lock size={9} className="text-amber-500/60 flex-shrink-0" />
        <span className="text-[10px] text-amber-700/70 dark:text-amber-400/60 tracking-wide">
          This is meant for internal employees only as this is confidential information.
        </span>
      </div>

      {/* Nav tabs */}
      <div className="h-10 bg-card border-b border-border flex items-end px-6 gap-1">
        {([['insights', 'Insights'], ['cases', 'Cases'], ['aging', 'Aging'], ['reports', 'Reports']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t
                ? 'border-amber-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}
