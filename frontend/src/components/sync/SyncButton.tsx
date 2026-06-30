import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import SyncModal from './SyncModal';

export default function SyncButton() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['sync-status'], queryFn: api.syncStatus, refetchInterval: 5000 });

  const syncing = data?.syncing ?? false;
  const pct = syncing && data?.phase === 'saving' && (data?.total ?? 0) > 0
    ? Math.round((data!.upserted / data!.total) * 100)
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
        <span className="hidden sm:inline tabular-nums">
          {pct !== null ? `${pct}%` : 'Sync'}
        </span>
        {syncing && pct === null && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>
      <SyncModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
