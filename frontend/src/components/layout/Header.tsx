import { Moon, Sun, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import SyncButton from '@/components/sync/SyncButton';
import { api } from '@/lib/api';

export default function Header() {
  const { tab, setTab, toggleTheme, theme } = useAppStore();
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    // Use client's local date (YYYY-MM-DD) so the counter resets at local midnight, not UTC midnight
    const localDate = new Date().toLocaleDateString('en-CA');
    if (sessionStorage.getItem('pinged')) {
      api.todayVisitors(localDate).then(d => setVisitorCount(d.count)).catch(() => {});
    } else {
      sessionStorage.setItem('pinged', '1');
      api.pingVisitor(localDate).then(d => setVisitorCount(d.count)).catch(() => {});
    }
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

        <SyncButton />

        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Nav tabs */}
      <div className="h-10 bg-card border-b border-border flex items-end px-6 gap-1">
        {([['insights', 'Insights'], ['cases', 'Cases'], ['aging', 'Aging']] as const).map(([t, label]) => (
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
