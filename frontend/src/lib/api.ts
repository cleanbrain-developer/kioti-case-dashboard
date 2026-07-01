import type { CasesFilter, CasesResponse, InsightsResponse, DrillResponse, SyncStatus, HealthResponse, AgingResponse, EmailRecipient, EmailSchedule } from '@/types';

const BASE = '/api';

async function extractError(res: Response): Promise<never> {
  const text = await res.text();
  let msg = text;
  try { msg = JSON.parse(text).message || text; } catch { /* not JSON */ }
  throw new Error(msg);
}

async function get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined) url.searchParams.set(k, String(v)); });
  const res = await fetch(url.toString());
  if (!res.ok) await extractError(res);
  return res.json();
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await extractError(res);
  return res.json();
}

async function put<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await extractError(res);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) await extractError(res);
  return res.json();
}

export const api = {
  health  : ()                   => get<HealthResponse>('/health'),
  insights: ()                   => get<InsightsResponse>('/insights'),
  drill   : (department: string) => get<DrillResponse>('/insights/drill', { department }),
  cases   : (f: Partial<CasesFilter>) => get<CasesResponse>('/cases', f as any),
  syncStatus: ()                 => get<SyncStatus>('/sync/status'),
  triggerSync: (password: string) => post<{ message: string }>('/sync', { password }),
  aging        : ()                => get<AgingResponse>('/insights/aging'),
  pingVisitor  : (date: string, sessionId: string) => post<{ count: number }>('/visitors/ping', { date, sessionId }),
  todayVisitors: (date: string)                    => get<{ count: number }>('/visitors/today', { date }),

  // Reports
  reports: {
    getSchedule    : ()                                       => get<EmailSchedule>('/reports/schedule'),
    updateSchedule : (s: Omit<EmailSchedule, 'id' | 'lastSentAt' | 'updatedAt'>) => put<EmailSchedule>('/reports/schedule', s),
    getDepartments : ()                                       => get<string[]>('/reports/departments'),
    listRecipients : ()                                       => get<EmailRecipient[]>('/reports/recipients'),
    createRecipient: (dto: { email: string; name: string; departments: string[] }) => post<EmailRecipient>('/reports/recipients', dto),
    updateRecipient: (id: number, dto: { email: string; name: string; departments: string[] }) => put<EmailRecipient>(`/reports/recipients/${id}`, dto),
    deleteRecipient: (id: number)                            => del<{ deleted: number }>(`/reports/recipients/${id}`),
    sendTest       : (email: string, department: string)     => post<{ ok: boolean; message: string }>('/reports/send-test', { email, department }),
    sendNow        : ()                                       => post<{ ok: boolean; sent: number }>('/reports/send-now', {}),
  },
};
