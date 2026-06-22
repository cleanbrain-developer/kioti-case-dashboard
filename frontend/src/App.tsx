import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/layout/Header';
import InsightsPage from '@/pages/InsightsPage';
import CasesPage from '@/pages/CasesPage';

export default function App() {
  const { tab, theme, setTheme } = useAppStore();

  // Apply saved theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  // Health check / field discovery
  useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-[104px]">
        {tab === 'insights' ? <InsightsPage /> : <CasesPage />}
      </main>
    </div>
  );
}
