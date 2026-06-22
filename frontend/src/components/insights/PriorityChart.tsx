import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/appStore';

interface Props { data: Array<{ Priority: string; total: number }>; }

export default function PriorityChart({ data }: Props) {
  const theme = useAppStore(s => s.theme);
  const isDark = theme === 'dark';

  const COLORS: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical', right: 10, top: 'middle',
      textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['40%', '50%'],
      data: data.map(d => ({
        name : d.Priority || 'Unknown',
        value: d.total,
        itemStyle: { color: COLORS[d.Priority] || '#94a3b8', borderRadius: 4 },
      })),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
  };

  return (
    <Card>
      <CardHeader><CardTitle>Open Cases by Priority</CardTitle></CardHeader>
      <CardContent>
        <ReactECharts option={option} style={{ height: 220 }} />
      </CardContent>
    </Card>
  );
}
