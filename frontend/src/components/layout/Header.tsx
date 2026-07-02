import { Moon, Sun, Users, Calendar, AlertCircle, BarChart2, List, Clock, Mail } from 'lucide-react';
import { useEffect, useState, type ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import SyncButton from '@/components/sync/SyncButton';
import { api } from '@/lib/api';

function fmtSyncTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const NAV_ITEMS: { key: 'insights' | 'cases' | 'aging' | 'reports'; label: string; Icon: ElementType }[] = [
  { key: 'insights', label: 'Insights', Icon: BarChart2 },
  { key: 'cases',    label: 'Cases',    Icon: List      },
  { key: 'aging',    label: 'Aging',    Icon: Clock     },
  { key: 'reports',  label: 'Reports',  Icon: Mail      },
];

export default function Header() {
  const { tab, setTab, toggleTheme, theme } = useAppStore();
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: api.syncStatus,
    refetchInterval: (q) => q.state.data?.syncing ? 5_000 : 30_000,
  });
  const lastSyncAt = syncStatus?.lastResult?.at ?? null;

  useEffect(() => {
    let cancelled = false;
    const localDate = new Date().toLocaleDateString('en-CA');
    let sessionId = sessionStorage.getItem('visitSessionId');
    if (!sessionId) {
      try { sessionId = crypto.randomUUID(); }
      catch { sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      sessionStorage.setItem('visitSessionId', sessionId);
      api.pingVisitor(localDate, sessionId)
        .then(d => { if (!cancelled) setVisitorCount(d.count); })
        .catch(() => {});
    } else {
      api.todayVisitors(localDate)
        .then(d => { if (!cancelled) setVisitorCount(d.count); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Confidential notice */}
      <div className="h-6 bg-[#2d1100] flex items-center justify-center gap-1.5 px-4">
        <AlertCircle size={11} className="text-amber-500 flex-shrink-0" />
        <span className="text-[11px] text-amber-300/80 tracking-wide">
          For internal employees only — this dashboard contains confidential information.
        </span>
      </div>

      {/* Top bar */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 shadow-lg">
        <div className="max-w-[1280px] mx-auto h-14 flex items-center px-4 gap-3">

          {/* Logo + 2-line title */}
          <div className="flex items-center gap-2.5">
            <img src="/kioti-logo.png" alt="KIOTI" className="h-8 w-auto object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="text-white font-semibold text-sm">
                KIOTI <span className="text-amber-400 font-bold">Case</span>
              </span>
              <span className="text-slate-400 text-xs">Dashboard</span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Last sync */}
          {lastSyncAt && (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-xs">
              <Calendar size={11} />
              <span>Last sync: <span className="text-slate-200">{fmtSyncTime(lastSyncAt)}</span></span>
            </div>
          )}

          {/* Sync button */}
          <SyncButton />

          {/* Visitor count */}
          {visitorCount !== null && (
            <div className="hidden sm:flex items-center gap-1 text-slate-400 text-xs">
              <Users size={12} />
              <span>
                <span className="text-slate-200 font-medium">{visitorCount.toLocaleString()}</span> today
              </span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="bg-slate-900 border-b border-slate-700/60">
        <div className="max-w-[1280px] mx-auto flex items-end px-4 gap-0.5">
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
                tab === key
                  ? 'border-amber-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600',
              ].join(' ')}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
