import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/layout/Header';
import InsightsPage from '@/pages/InsightsPage';
import CasesPage from '@/pages/CasesPage';
import AgingPage from '@/pages/AgingPage';

const VALID_TABS = ['insights', 'cases', 'aging'] as const;
type Tab = typeof VALID_TABS[number];

export default function App() {
  const { tab, theme, setTab } = useAppStore();
  const firstRender = useRef(true);

  // Apply saved theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  // Sync tab → browser history
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      history.replaceState({ tab }, '', `#${tab}`);
      return;
    }
    const hash = window.location.hash.slice(1);
    if (hash !== tab) history.pushState({ tab }, '', `#${tab}`);
  }, [tab]);

  // Handle back / forward button
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const t = (e.state?.tab ?? window.location.hash.slice(1)) as Tab;
      if (VALID_TABS.includes(t)) setTab(t);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setTab]);

  // Health check / field discovery
  useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-[104px]">
        {tab === 'insights' ? <InsightsPage /> : tab === 'cases' ? <CasesPage /> : <AgingPage />}
      </main>
    </div>
  );
}
