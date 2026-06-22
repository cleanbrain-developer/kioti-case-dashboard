import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/appStore';
import type { PicData, DrillRecord } from '@/types';

interface Props {
  data: (PicData | DrillRecord)[];
  title: string;
  selectedDept: string | null;
}

export default function PicChart({ data, title, selectedDept }: Props) {
  const { theme, goToCasesWithPic } = useAppStore();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const names  = data.map(d => ('name' in d ? d.name : d.key));
  const counts = data.map(d => ('count' in d ? d.count : 0));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
      formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value} open cases</b>`,
    },
    grid: { left: 120, right: 56, top: 8, bottom: 8 },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: [...names].reverse(),
      axisLabel: { color: textColor, fontSize: 12, width: 110, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: [...counts].reverse(),
      itemStyle: {
        color: (p: any) => {
          const colors = ['#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899'];
          return colors[p.dataIndex % colors.length];
        },
        borderRadius: [0, 4, 4, 0],
      },
      emphasis: { itemStyle: { opacity: 0.8 } },
      label: { show: true, position: 'right', color: textColor, fontSize: 11 },
    }],
  };

  const onEvents = {
    click: (params: any) => {
      const name = [...names].reverse()[params.dataIndex];
      if (name) goToCasesWithPic(name, selectedDept || undefined);
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {selectedDept && (
          <span className="text-xs text-muted-foreground mt-0.5">Dept: {selectedDept}</span>
        )}
      </CardHeader>
      <CardContent>
        <ReactECharts
          option={option}
          style={{ height: Math.max(200, data.length * 32 + 20) }}
          onEvents={onEvents}
        />
        <p className="text-xs text-muted-foreground text-center mt-1">Click a bar to view cases for that person</p>
      </CardContent>
    </Card>
  );
}
