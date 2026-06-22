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

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  // Sort ascending so largest bar ends up at top in horizontal chart
  const sorted = [...data].sort((a, b) => a.open - b.open);
  const labels = sorted.map(d => d.key);
  const values = sorted.map(d => d.open);
  const maxVal = Math.max(...values, 1);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
      formatter: (params: any[]) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>Open: <strong>${p.value}</strong>`;
      },
    },
    grid: { left: 12, right: 60, bottom: 12, top: 12, containLabel: true },
    xAxis: {
      type: 'value',
      max: Math.ceil(maxVal * 1.15),
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        color: textColor,
        fontSize: 11,
        width: 130,
        overflow: 'truncate',
        formatter: (val: string) => val.length > 20 ? val.slice(0, 18) + '…' : val,
      },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: labels[i] === selected
              ? (isDark ? '#60a5fa' : '#1d4ed8')
              : (isDark ? '#3b82f6' : '#3b82f6'),
            borderRadius: [0, 4, 4, 0],
            opacity: selected && labels[i] !== selected ? 0.45 : 1,
          },
        })),
        barMaxWidth: 28,
        barMinHeight: 6,
        label: {
          show: true,
          position: 'right',
          color: textColor,
          fontSize: 11,
          formatter: (p: any) => p.value,
        },
      },
    ],
  };

  const onEvents = {
    click: (params: any) => {
      const dept = labels[params.dataIndex];
      if (!dept) return;
      onSelect(selected === dept ? null : dept);
    },
  };

  const chartHeight = Math.max(260, sorted.length * 36 + 40);

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
        <ReactECharts
          option={option}
          style={{ height: chartHeight }}
          onEvents={onEvents}
        />
        <p className="text-xs text-muted-foreground text-center mt-1">Click a bar to drill down by PIC</p>
      </CardContent>
    </Card>
  );
}
