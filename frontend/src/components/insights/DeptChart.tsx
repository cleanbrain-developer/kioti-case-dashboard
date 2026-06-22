import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/appStore';
import type { DeptData } from '@/types';

interface Props {
  data: DeptData[];
  selected: string | null;
  onSelect: (dept: string | null) => void;
}

export default function DeptChart({ data, selected, onSelect }: Props) {
  const theme = useAppStore(s => s.theme);
  const isDark = theme === 'dark';

  const textColor  = isDark ? '#94a3b8' : '#64748b';
  const gridColor  = isDark ? '#1e293b' : '#f1f5f9';

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
    },
    legend: {
      data: ['Open', 'Closed'],
      textStyle: { color: textColor },
      right: 10, top: 0,
    },
    grid: { left: 16, right: 16, bottom: 40, top: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.key),
      axisLabel: { color: textColor, fontSize: 11, rotate: data.length > 6 ? 30 : 0, overflow: 'truncate', width: 100 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        name: 'Open',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.open),
        itemStyle: { color: '#3b82f6', borderRadius: [0, 0, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: 'Closed',
        type: 'bar',
        stack: 'total',
        data: data.map(d => (d.total || d.open) - d.open),
        itemStyle: { color: isDark ? '#334155' : '#e2e8f0', borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
    ],
  };

  const onEvents = {
    click: (params: any) => {
      const dept = data[params.dataIndex]?.key;
      if (!dept) return;
      onSelect(selected === dept ? null : dept);
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Cases by Department</CardTitle>
        {selected && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Filtered:</span>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{selected}</span>
            <button onClick={() => onSelect(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Clear</button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ReactECharts option={option} style={{ height: 280 }} onEvents={onEvents} />
        <p className="text-xs text-muted-foreground text-center mt-1">Click a bar to drill down by PIC</p>
      </CardContent>
    </Card>
  );
}
