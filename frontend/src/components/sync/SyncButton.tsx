import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import SyncModal from './SyncModal';

export default function SyncButton() {
  const [open, setOpen] = useState(false);
  // Poll every 5s while syncing, 30s otherwise — SyncModal handles fine-grained progress tracking
  const { data } = useQuery({ queryKey: ['sync-status'], queryFn: api.syncStatus, refetchInterval: (q) => q.state.data?.syncing ? 5_000 : 30_000 });

  const syncing = data?.syncing ?? false;
  const pct = syncing && data?.phase === 'saving' && (data?.total ?? 0) > 0
    ? Math.round((data!.upserted / data!.total) * 100)
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-600/70 text-xs font-medium text-slate-200 hover:bg-white/10 hover:border-slate-500 transition-colors"
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
