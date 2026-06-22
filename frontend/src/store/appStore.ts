import { create } from 'zustand';
import type { CasesFilter } from '@/types';

type Tab = 'insights' | 'cases' | 'aging';
type Theme = 'light' | 'dark';

interface AppState {
  tab   : Tab;
  theme : Theme;
  filter: CasesFilter;
  insightsDept: string | null;

  setTab  : (tab: Tab) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setFilter : (patch: Partial<CasesFilter>) => void;
  resetFilter: () => void;
  setInsightsDept: (dept: string | null) => void;
  goToCasesWithPic: (picName: string, deptName?: string) => void;
}

const DEFAULT_FILTER: CasesFilter = {
  search: '', status: '', priority: '', department: '',
  personInCharge: '', moduleLevel: '', dateFrom: '', dateTo: '',
  page: 1, pageSize: 25, sortField: 'CreatedDate', sortDir: 'DESC',
};

export const useAppStore = create<AppState>((set) => ({
  tab  : 'insights',
  theme: (localStorage.getItem('theme') as Theme) || 'dark',
  filter: { ...DEFAULT_FILTER },
  insightsDept: null,

  setTab: (tab) => set({ tab }),

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },

  toggleTheme: () => set((s) => {
    const next = s.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    return { theme: next };
  }),

  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch, page: patch.page ?? 1 } })),

  resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),

  setInsightsDept: (dept) => set({ insightsDept: dept }),

  goToCasesWithPic: (picName, deptName) => set({
    tab: 'cases',
    filter: {
      ...DEFAULT_FILTER,
      status        : 'Open',
      personInCharge: picName,
      department    : deptName || '',
    },
  }),
}));
