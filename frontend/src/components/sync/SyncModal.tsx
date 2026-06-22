import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import type { SyncStatus } from '@/types';

interface Props { open: boolean; onClose: () => void; }

type State = 'password' | 'loading' | 'done' | 'error';

export default function SyncModal({ open, onClose }: Props) {
  const [uiState, setUiState] = useState<State>('password');
  const [password, setPassword] = useState('');
  const [status, setStatus]   = useState<SyncStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  useEffect(() => {
    if (!open) { stopPoll(); setUiState('password'); setPassword(''); setStatus(null); setErrorMsg(''); }
  }, [open]);

  const startPoll = () => {
    pollRef.current = setInterval(async () => {
      const s = await api.syncStatus();
      setStatus(s);
      if (!s.syncing) {
        stopPoll();
        setUiState(s.lastResult?.success ? 'done' : 'error');
        if (!s.lastResult?.success) setErrorMsg(s.lastResult?.error || 'Unknown error');
      }
    }, 1200);
  };

  const handleSync = async () => {
    setUiState('loading');
    try {
      await api.triggerSync(password);
      startPoll();
    } catch (e: any) {
      const msg = e.message || '';
      setErrorMsg(msg.includes('401') ? 'Incorrect password' : msg);
      setUiState('error');
    }
  };

  const progressPct = status && status.total > 0 ? Math.round(status.upserted / status.total * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw size={18} className="text-primary" />
            Salesforce Sync
          </DialogTitle>
        </DialogHeader>

        {uiState === 'password' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter admin password to trigger a manual sync.</p>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && password && handleSync()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSync} disabled={!password}>Start Sync</Button>
            </div>
          </div>
        )}

        {uiState === 'loading' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-sm font-medium capitalize">{status?.phase || 'Starting'}…</span>
            </div>
            {status && status.total > 0 && (
              <>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {status.upserted.toLocaleString()} / {status.total.toLocaleString()} cases
                  {status.elapsed && ` · ${formatDuration(status.elapsed)}`}
                </p>
              </>
            )}
          </div>
        )}

        {uiState === 'done' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={22} />
              <span className="font-semibold">Sync complete</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {status?.lastResult?.count?.toLocaleString()} cases synced
              {status?.lastResult?.duration && ` in ${formatDuration(status.lastResult.duration)}`}
            </p>
            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        )}

        {uiState === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <XCircle size={22} />
              <span className="font-semibold">Sync failed</span>
            </div>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => { setUiState('password'); setErrorMsg(''); }}>Retry</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
