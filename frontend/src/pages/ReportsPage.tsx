import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Trash2, Pencil, Send, Clock, Users, Calendar, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { EmailRecipient, EmailSchedule } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── helpers ──────────────────────────────────────────────────────────────────

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SELECT_CLS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-ring';

function nextRunLabel(s: EmailSchedule): string {
  if (!s.enabled) return 'Disabled';
  const dow = s.dayOfWeek != null ? DOW_LABELS[s.dayOfWeek] : null;
  const dom = s.dayOfMonth != null ? `${s.dayOfMonth}th of month` : null;
  const hh  = String(s.hourEst).padStart(2, '0');
  const mm  = String(s.minuteEst).padStart(2, '0');
  const day = s.freq === 'weekly' ? (dow ?? '—') : (dom ?? '—');
  return `Every ${day} at ${hh}:${mm} EST`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── Recipient form ─────────────────────────────────────────────────────────

interface RecipientFormProps {
  initial?: EmailRecipient;
  departments: string[];
  onSave: (dto: { email: string; name: string; departments: string[] }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function RecipientForm({ initial, departments, onSave, onCancel, saving }: RecipientFormProps) {
  const [email, setEmail]   = useState(initial?.email ?? '');
  const [name, setName]     = useState(initial?.name ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.departments ?? []));

  const toggle = (d: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(d) ? s.delete(d) : s.add(d); return s; });

  const handleSave = async () => {
    if (!email.trim() || !name.trim()) return;
    await onSave({ email: email.trim(), name: name.trim(), departments: [...selected] });
  };

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" type="email" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Departments to follow <span className="text-muted-foreground/60 normal-case font-normal">(none = all)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {departments.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={[
                'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                selected.has(d)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-muted/30 border-border text-muted-foreground hover:border-amber-500/30 hover:text-foreground',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
          {departments.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No departments loaded yet</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving || !email.trim() || !name.trim()} size="sm">
          {saving && <Loader2 size={12} className="mr-1.5 animate-spin" />}
          {initial ? 'Update' : 'Add Recipient'}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────────

function ScheduleCard({ schedule, onSave }: { schedule: EmailSchedule; onSave: (s: EmailSchedule) => void }) {
  const [local, setLocal]   = useState<EmailSchedule>(schedule);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocal(schedule); }, [schedule]);
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const patch = (p: Partial<EmailSchedule>) => setLocal(prev => ({ ...prev, ...p }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(local);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const hourOpts   = Array.from({ length: 24 }, (_, i) => i);
  const minuteOpts = [0, 15, 30, 45];
  const domOpts    = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400" /> Send Schedule
          </CardTitle>
          {/* Enable toggle */}
          <button
            onClick={() => patch({ enabled: !local.enabled })}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              local.enabled ? 'bg-amber-500' : 'bg-muted',
            ].join(' ')}
          >
            <span className={[
              'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
              local.enabled ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{nextRunLabel(local)}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Frequency */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frequency</label>
            <select className={SELECT_CLS} value={local.freq}
              onChange={e => patch({ freq: e.target.value as 'weekly' | 'monthly', dayOfWeek: 1, dayOfMonth: 1 })}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Day */}
          {local.freq === 'weekly' ? (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day of week</label>
              <select className={SELECT_CLS} value={local.dayOfWeek ?? 1}
                onChange={e => patch({ dayOfWeek: parseInt(e.target.value, 10) })}>
                {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day of month</label>
              <select className={SELECT_CLS} value={local.dayOfMonth ?? 1}
                onChange={e => patch({ dayOfMonth: parseInt(e.target.value, 10) })}>
                {domOpts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Hour */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hour (EST)</label>
            <select className={SELECT_CLS} value={local.hourEst}
              onChange={e => patch({ hourEst: parseInt(e.target.value, 10) })}>
              {hourOpts.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>

          {/* Minute */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minute</label>
            <select className={SELECT_CLS} value={local.minuteEst}
              onChange={e => patch({ minuteEst: parseInt(e.target.value, 10) })}>
              {minuteOpts.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving
              ? <><Loader2 size={12} className="mr-1.5 animate-spin" />Saving…</>
              : saved
              ? <><CheckCircle2 size={12} className="mr-1.5 text-green-400" />Saved</>
              : 'Save Schedule'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Last sent: {fmtDate(schedule.lastSentAt)}
          </span>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <span className="text-amber-400 text-xs mt-0.5">ℹ</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Email is sent from <span className="text-foreground font-medium">no-reply@kiotitractor.com</span>.
            Configure SMTP credentials (<code className="text-xs bg-muted px-1 rounded">SMTP_HOST</code>,{' '}
            <code className="text-xs bg-muted px-1 rounded">SMTP_USER</code>,{' '}
            <code className="text-xs bg-muted px-1 rounded">SMTP_PASS</code>) in the server <code className="text-xs bg-muted px-1 rounded">.env</code> file.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Test send card ────────────────────────────────────────────────────────

function TestSendCard({ departments }: { departments: string[] }) {
  const [toEmail, setToEmail]   = useState('');
  const [dept, setDept]         = useState('');
  const [result, setResult]     = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    if (departments.length > 0 && !dept) setDept(departments[0]);
  }, [departments]);

  const handleSend = async () => {
    if (!toEmail.trim() || !dept) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.reports.sendTest(toEmail.trim(), dept);
      setResult(res);
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send size={16} className="text-amber-400" /> Test Email
        </CardTitle>
        <p className="text-xs text-muted-foreground">Send a sample report to verify layout and SMTP config.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient email</label>
            <Input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="you@company.com" type="email" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
            <select className={SELECT_CLS} value={dept} onChange={e => setDept(e.target.value)}>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
              {departments.length === 0 && <option value="">Loading…</option>}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSend} disabled={sending || !toEmail.trim() || !dept} size="sm" variant="outline">
            {sending
              ? <><Loader2 size={12} className="mr-1.5 animate-spin" />Sending…</>
              : <><Send size={12} className="mr-1.5" />Send Test Email</>}
          </Button>

          {result && (
            <div className={[
              'flex items-center gap-1.5 text-xs font-medium',
              result.ok ? 'text-green-400' : 'text-red-400',
            ].join(' ')}>
              {result.ok
                ? <CheckCircle2 size={14} />
                : <XCircle size={14} />}
              {result.message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId]       = useState<number | 'new' | null>(null);
  const [mutSaving, setMutSaving]       = useState(false);
  const [sendNowResult, setSendNowResult] = useState<string | null>(null);
  const [sendingNow, setSendingNow]     = useState(false);

  const { data: schedule } = useQuery({
    queryKey: ['reports-schedule'],
    queryFn : api.reports.getSchedule,
  });
  const { data: recipients = [] } = useQuery({
    queryKey: ['reports-recipients'],
    queryFn : api.reports.listRecipients,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['reports-departments'],
    queryFn : api.reports.getDepartments,
  });

  const saveSchedule = async (s: EmailSchedule) => {
    await api.reports.updateSchedule({
      enabled    : s.enabled,
      freq       : s.freq,
      dayOfWeek  : s.dayOfWeek,
      dayOfMonth : s.dayOfMonth,
      hourEst    : s.hourEst,
      minuteEst  : s.minuteEst,
    });
    qc.invalidateQueries({ queryKey: ['reports-schedule'] });
  };

  const handleCreate = async (dto: { email: string; name: string; departments: string[] }) => {
    setMutSaving(true);
    try {
      await api.reports.createRecipient(dto);
      qc.invalidateQueries({ queryKey: ['reports-recipients'] });
      setEditingId(null);
    } finally { setMutSaving(false); }
  };

  const handleUpdate = async (id: number, dto: { email: string; name: string; departments: string[] }) => {
    setMutSaving(true);
    try {
      await api.reports.updateRecipient(id, dto);
      qc.invalidateQueries({ queryKey: ['reports-recipients'] });
      setEditingId(null);
    } finally { setMutSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this recipient?')) return;
    await api.reports.deleteRecipient(id);
    qc.invalidateQueries({ queryKey: ['reports-recipients'] });
  };

  const handleSendNow = async () => {
    setSendingNow(true);
    setSendNowResult(null);
    try {
      const res = await api.reports.sendNow();
      setSendNowResult(`✓ Sent to ${res.sent} recipient(s)`);
    } catch (e: any) {
      setSendNowResult(`✗ ${e.message}`);
    } finally {
      setSendingNow(false);
      qc.invalidateQueries({ queryKey: ['reports-schedule'] });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail size={18} className="text-amber-400" /> Weekly Report Email
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated department-based case reports · Department followers management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sendNowResult && (
            <span className={['text-xs font-medium', sendNowResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'].join(' ')}>
              {sendNowResult}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSendNow} disabled={sendingNow}>
            {sendingNow
              ? <><Loader2 size={12} className="mr-1.5 animate-spin" />Sending…</>
              : <><Send size={12} className="mr-1.5" />Send Now</>}
          </Button>
        </div>
      </div>

      {/* Schedule */}
      {schedule && <ScheduleCard schedule={schedule} onSave={saveSchedule} />}

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              Mailing List
              <span className="text-xs font-normal text-muted-foreground ml-1">({recipients.length} recipients)</span>
            </CardTitle>
            {editingId !== 'new' && (
              <Button size="sm" onClick={() => setEditingId('new')}>
                <Plus size={13} className="mr-1.5" /> Add Recipient
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add new form */}
          {editingId === 'new' && (
            <RecipientForm
              departments={departments}
              onSave={handleCreate}
              onCancel={() => setEditingId(null)}
              saving={mutSaving}
            />
          )}

          {/* Recipients list */}
          {recipients.length === 0 && editingId !== 'new' ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No recipients yet. Add one to start sending reports.
            </div>
          ) : (
            <div className="space-y-2">
              {recipients.map(r => (
                <div key={r.id}>
                  {editingId === r.id ? (
                    <RecipientForm
                      initial={r}
                      departments={departments}
                      onSave={dto => handleUpdate(r.id, dto)}
                      onCancel={() => setEditingId(null)}
                      saving={mutSaving}
                    />
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{r.name}</span>
                          <span className="text-muted-foreground text-xs">{r.email}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.departments.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">All departments</span>
                          ) : r.departments.map(d => (
                            <span key={d}
                              className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingId(r.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Send */}
      <TestSendCard departments={departments} />

      {/* Report content preview card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" /> Report Contents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { icon: '📊', title: 'KPI Summary', desc: 'Total open, avg age, new this week, recently closed' },
              { icon: '⚠️', title: 'Open Workload by Assignee', desc: 'Ranked list of who holds the most open cases with priority breakdown' },
              { icon: '🎯', title: 'Priority Breakdown', desc: 'High / Medium / Low distribution of open cases' },
              { icon: '🕐', title: 'Oldest Open Cases', desc: 'Top 5 longest-running open cases with age and assignee' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                <div>
                  <div className="font-medium text-foreground text-xs">{item.title}</div>
                  <div className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Each recipient receives one email covering all departments they follow.
            Recipients with no department assignment receive all departments.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
