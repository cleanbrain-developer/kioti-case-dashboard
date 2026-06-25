import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Database, CloudDownload, ShieldCheck, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDuration, formatDateTime } from '@/lib/utils';
import type { SyncStatus } from '@/types';

interface Props { open: boolean; onClose: () => void; }
type UiState = 'password' | 'loading' | 'done' | 'error';

const STEPS = [
  { key: 'auth',     label: 'Authenticating',          Icon: ShieldCheck   },
  { key: 'fetching', label: 'Fetching from Salesforce', Icon: CloudDownload },
  { key: 'saving',   label: 'Saving to database',       Icon: Database      },
] as const;

const PHASE_ORDER = ['auth', 'fetching', 'saving'];

function stepState(stepKey: string, phase: string): 'done' | 'active' | 'pending' {
  const si = PHASE_ORDER.indexOf(stepKey);
  const pi = PHASE_ORDER.indexOf(phase);
  if (pi > si) return 'done';
  if (pi === si) return 'active';
  return 'pending';
}

export default function SyncModal({ open, onClose }: Props) {
  const [uiState, setUiState]   = useState<UiState>('password');
  const [password, setPassword] = useState('');
  const [status, setStatus]     = useState<SyncStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll  = () => { if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; } };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const startTimer = () => {
    const t0 = Date.now();
    setElapsedSec(0);
    timerRef.current = setInterval(() => setElapsedSec(Math.floor((Date.now() - t0) / 1000)), 1000);
  };

  const startPoll = () => {
    pollRef.current = setInterval(async () => {
      const s = await api.syncStatus();
      setStatus(s);
      if (!s.syncing) {
        stopPoll(); stopTimer();
        setUiState(s.lastResult?.success ? 'done' : 'error');
        if (!s.lastResult?.success) setErrorMsg(s.lastResult?.error || 'Unknown error');
      }
    }, 1200);
  };

  useEffect(() => {
    if (open) {
      api.syncStatus().then(s => {
        setStatus(s);
        if (s.syncing) {
          setUiState('loading');
          startTimer();
          startPoll();
        }
      }).catch(() => {});
    } else {
      stopPoll(); stopTimer();
      setUiState('password'); setPassword(''); setStatus(null); setErrorMsg(''); setElapsedSec(0);
    }
  }, [open]);

  const handleSync = async () => {
    setUiState('loading');
    try {
      await api.triggerSync(password);
      startTimer();
      startPoll();
    } catch (e: any) {
      const msg = e.message || '';
      setErrorMsg(msg.includes('401') ? 'Incorrect password' : msg);
      setUiState('error');
    }
  };

  const phase = status?.phase ?? 'auth';
  const progressPct = status && status.total > 0
    ? Math.min(100, Math.round(status.upserted / status.total * 100))
    : 0;

  const fmtSec = (sec: number) =>
    sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <RefreshCw size={15} className="text-primary" />
            Salesforce Full Sync
          </DialogTitle>
        </DialogHeader>

        {/* ── PASSWORD ── */}
        {uiState === 'password' && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fetches all cases from Salesforce and updates the local database.
            </p>

            {status?.lastResult && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                <Clock size={11} className="flex-shrink-0" />
                <span>
                  Last sync: {formatDateTime(status.lastResult.at)}
                  {status.lastResult.count !== undefined && ` · ${status.lastResult.count.toLocaleString()} cases`}
                  {status.lastResult.duration !== undefined && ` · ${formatDuration(status.lastResult.duration)}`}
                </span>
              </div>
            )}

            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && password && handleSync()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSync} disabled={!password}>Start Sync</Button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {uiState === 'loading' && (
          <div className="space-y-5 pt-1">

            {/* Phase steps */}
            <div className="space-y-2.5">
              {STEPS.map(({ key, label, Icon }) => {
                const state = stepState(key, phase);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      state === 'done'   ? 'bg-emerald-500/15 text-emerald-500' :
                      state === 'active' ? 'bg-primary/15 text-primary ring-2 ring-primary/30' :
                                           'bg-muted/60 text-muted-foreground/50'
                    }`}>
                      {state === 'done'
                        ? <CheckCircle2 size={13} />
                        : <Icon size={13} className={state === 'active' ? 'animate-pulse' : ''} />
                      }
                    </div>
                    <span className={`text-xs flex-1 ${
                      state === 'active' ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}>
                      {label}
                    </span>
                    {key === 'fetching' && status && status.fetched > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {status.fetched.toLocaleString()} records
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar — visible during saving */}
            {phase === 'saving' && status && status.total > 0 && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{status.upserted.toLocaleString()} / {status.total.toLocaleString()} cases</span>
                  <span>{progressPct}%</span>
                </div>
              </div>
            )}

            {/* Elapsed timer */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={11} />
              <span className="tabular-nums">{fmtSec(elapsedSec)}</span>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {uiState === 'done' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 size={18} />
              <span className="text-sm font-semibold">Sync Complete</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-base font-semibold tabular-nums">
                  {(status?.lastResult?.count ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Cases</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-base font-semibold tabular-nums">
                  {status?.lastResult?.duration ? formatDuration(status.lastResult.duration) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Duration</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-sm font-semibold">
                  {status?.lastResult?.at
                    ? new Date(status.lastResult.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
              </div>
            </div>

            <Button onClick={onClose} className="w-full" size="sm">Close</Button>
          </div>
        )}

        {/* ── ERROR ── */}
        {uiState === 'error' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle size={18} />
              <span className="text-sm font-semibold">Sync Failed</span>
            </div>
            <p className="text-xs text-muted-foreground rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 font-mono break-all leading-relaxed">
              {errorMsg}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={() => { setUiState('password'); setErrorMsg(''); }}>Retry</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
