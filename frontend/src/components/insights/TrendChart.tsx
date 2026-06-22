import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/appStore';
import type { TrendData } from '@/types';

interface Props { data: TrendData[]; }

export default function TrendChart({ data }: Props) {
  const theme = useAppStore(s => s.theme);
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const labels = data.map(d => `${d.yr}/${String(d.mo).padStart(2,'0')}`);
  const values = data.map(d => d.total);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
    },
    grid: { left: 10, right: 10, top: 8, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: textColor, fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { color: '#3b82f6', width: 2 },
      itemStyle: { color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59,130,246,0.3)' },
            { offset: 1, color: 'rgba(59,130,246,0)' },
          ],
        },
      },
    }],
  };

  return (
    <Card>
      <CardHeader><CardTitle>Cases Created Over Time</CardTitle></CardHeader>
      <CardContent>
        <ReactECharts option={option} style={{ height: 220 }} />
      </CardContent>
    </Card>
  );
}
