import { Moon, Sun } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import SyncButton from '@/components/sync/SyncButton';

export default function Header() {
  const { tab, setTab, toggleTheme, theme } = useAppStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top bar */}
      <div className="h-14 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center px-6 gap-4 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm">K</div>
          <span className="text-white font-bold text-lg tracking-tight">
            Kioti <span className="text-amber-400">Case</span> Dashboard
          </span>
        </div>

        <div className="flex-1" />

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
        {(['insights', 'cases'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition-all border-b-2 -mb-px',
              tab === t
                ? 'border-amber-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </header>
  );
}
