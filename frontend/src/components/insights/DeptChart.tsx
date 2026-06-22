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
  const closedColor = isDark ? '#334155' : '#cbd5e1';

  // Sort ascending by total so largest is at top in horizontal chart
  const sorted = [...data].sort((a, b) => a.total - b.total);
  const labels  = sorted.map(d => d.key);
  const opens   = sorted.map(d => d.open);
  const closeds = sorted.map(d => (d.total || d.open) - d.open);
  const totals  = sorted.map(d => d.total || d.open);
  const maxTotal = Math.max(...totals, 1);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f1f5f9' : '#0f172a', fontSize: 12 },
      formatter: (params: any[]) => {
        const name  = params[0].name;
        const open  = params.find(p => p.seriesName === 'Open')?.value  ?? 0;
        const closed = params.find(p => p.seriesName === 'Closed')?.value ?? 0;
        const total = open + closed;
        return [
          `<strong>${name}</strong>`,
          `Open: <strong style="color:#3b82f6">${open.toLocaleString()}</strong>`,
          `Closed: <strong>${closed.toLocaleString()}</strong>`,
          `Total: <strong>${total.toLocaleString()}</strong>`,
        ].join('<br/>');
      },
    },
    legend: {
      data: ['Open', 'Closed'],
      right: 0,
      top: 0,
      textStyle: { color: textColor, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: 12, right: 70, bottom: 12, top: 28, containLabel: true },
    xAxis: {
      type: 'value',
      max: Math.ceil(maxTotal * 1.12),
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
        name: 'Open',
        type: 'bar',
        stack: 'total',
        data: opens.map((v, i) => ({
          value: v,
          itemStyle: {
            color: labels[i] === selected ? (isDark ? '#60a5fa' : '#1d4ed8') : '#3b82f6',
            opacity: selected && labels[i] !== selected ? 0.45 : 1,
          },
        })),
        barMaxWidth: 24,
        barMinHeight: 4,
      },
      {
        name: 'Closed',
        type: 'bar',
        stack: 'total',
        data: closeds.map((v, i) => ({
          value: v,
          itemStyle: {
            color: closedColor,
            borderRadius: [0, 4, 4, 0],
            opacity: selected && labels[i] !== selected ? 0.35 : 0.8,
          },
        })),
        barMaxWidth: 24,
        barMinHeight: 4,
        label: {
          show: true,
          position: 'right',
          color: textColor,
          fontSize: 10,
          formatter: (p: any) => {
            const total = totals[p.dataIndex];
            const open  = opens[p.dataIndex];
            return `${open.toLocaleString()} / ${total.toLocaleString()}`;
          },
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

  const chartHeight = Math.max(260, sorted.length * 36 + 56);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cases by Department</CardTitle>
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
        <p className="text-xs text-muted-foreground text-center mt-1">
          Bar label = <span className="text-blue-500 font-medium">open</span> / total &nbsp;·&nbsp; Click a bar to drill down by PIC
        </p>
      </CardContent>
    </Card>
  );
}
