import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import KpiCards from '@/components/insights/KpiCards';
import DeptChart from '@/components/insights/DeptChart';
import PicChart from '@/components/insights/PicChart';
import TrendChart from '@/components/insights/TrendChart';
import PriorityChart from '@/components/insights/PriorityChart';

export default function InsightsPage() {
  const setInsightsDept = useAppStore(s => s.setInsightsDept);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['insights'],
    queryFn : api.insights,
    staleTime: 2 * 60_000,
  });

  const { data: drillData } = useQuery({
    queryKey: ['drill', selectedDept],
    queryFn : () => api.drill(selectedDept!),
    enabled : !!selectedDept,
    staleTime: 2 * 60_000,
  });

  const handleDeptSelect = (dept: string | null) => {
    setSelectedDept(dept);
    setInsightsDept(dept);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="p-6 text-center text-muted-foreground">
      Failed to load insights. Check server connection.
    </div>
  );

  const picData = selectedDept && drillData ? drillData.records : data.openByPic;
  const picTitle = selectedDept
    ? `Open Cases by PIC — ${selectedDept}`
    : 'Open Cases by Person In Charge';

  return (
    <div className="p-6 space-y-6">
      <KpiCards kpi={data.kpi} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DeptChart
          data={data.openByDept}
          selected={selectedDept}
          onSelect={handleDeptSelect}
        />
        <PicChart
          data={picData}
          title={picTitle}
          selectedDept={selectedDept}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TrendChart data={data.trend} />
        <PriorityChart data={data.priority} />
      </div>
    </div>
  );
}
