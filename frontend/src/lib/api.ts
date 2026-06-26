import type { CasesFilter, CasesResponse, InsightsResponse, DrillResponse, SyncStatus, HealthResponse, AgingResponse } from '@/types';

const BASE = '/api';

async function get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined) url.searchParams.set(k, String(v)); });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
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
  pingVisitor  : (date: string)    => post<{ count: number }>('/visitors/ping', { date }),
  todayVisitors: (date: string)    => get<{ count: number }>('/visitors/today', { date }),
};
