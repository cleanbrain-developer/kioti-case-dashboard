import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgingGroup, CasesFilter } from '@/types';

const BUCKETS  = ['0-30', '31-60', '61-90', '91-180', '181-365', '365+'] as const;
const B_LABELS = ['0–30d', '31–60d', '61–90d', '91–180d', '181–365d', '365+d'];
const B_FULL   = ['0–30 days', '31–60 days', '61–90 days', '91–180 days', '181–365 days', '365+ days'];
const B_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#b91c1c'];

type BucketKey = typeof BUCKETS[number];
type GroupType = 'department' | 'moduleLevel';

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function sub(d: Date, days: number) { return new Date(d.getTime() - days * 86400_000); }

function bucketDateRange(bucket: BucketKey): { dateFrom: string; dateTo: string } {
  const today = new Date();
  switch (bucket) {
    case '0-30'   : return { dateFrom: fmt(sub(today, 30)),  dateTo: fmt(today) };
    case '31-60'  : return { dateFrom: fmt(sub(today, 60)),  dateTo: fmt(sub(today, 31)) };
    case '61-90'  : return { dateFrom: fmt(sub(today, 90)),  dateTo: fmt(sub(today, 61)) };
    case '91-180' : return { dateFrom: fmt(sub(today, 180)), dateTo: fmt(sub(today, 91)) };
    case '181-365': return { dateFrom: fmt(sub(today, 365)), dateTo: fmt(sub(today, 181)) };
    case '365+'   : return { dateFrom: '2000-01-01',          dateTo: fmt(sub(today, 366)) };
  }
}

function KpiCard({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 px-4 pb-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate" title={sub}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

interface ChartProps {
  data    : AgingGroup[];
  title   : string;
  theme   : string;
  groupType: GroupType;
  onNavigate: (key: string, groupType: GroupType, bucket?: BucketKey) => void;
}

function AgingGroupChart({ data, title, theme, groupType, onNavigate }: ChartProps) {
  const isDark    = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const sorted = [...data].sort((a, b) => a.total - b.total);
  const labels = sorted.map(d => d.key.length > 26 ? d.key.slice(0, 24) + '…' : d.key);

  const series = BUCKETS.map((bucket, i) => ({
    name       : B_FULL[i],
    type       : 'bar',
    stack      : 'total',
    color      : B_COLORS[i],
    cursor     : 'pointer',
    data       : sorted.map(d => d.buckets[bucket] ?? 0),
    barMaxWidth: 20,
    emphasis   : { focus: 'series' },
    ...(i === BUCKETS.length - 1 ? {
      label: {
        show     : true,
        position : 'right',
        color    : textColor,
        fontSize : 10,
        formatter: (p: any) => sorted[p.dataIndex].total.toLocaleString(),
      },
    } : {}),
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger        : 'axis',
      axisPointer    : { type: 'shadow' },
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderColor    : isDark ? '#334155' : '#e2e8f0',
      textStyle      : { color: isDark ? '#f1f5f9' : '#0f172a', fontSize: 11 },
      formatter: (params: any[]) => {
        const idx = params[0].dataIndex;
        const g   = sorted[idx];
        const lines = [
          `<strong>${g.key}</strong>`,
          `Total: <strong>${g.total.toLocaleString()}</strong> · Avg: ${g.avgAge}d · Max: ${g.maxAge}d`,
          '<span style="font-size:10px;color:#94a3b8">Click a segment to view cases</span>',
          '',
        ];
        params.forEach(p => {
          if (p.value > 0)
            lines.push(`<span style="color:${p.color}">●</span> ${p.seriesName}: ${(p.value as number).toLocaleString()}`);
        });
        return lines.join('<br/>');
      },
    },
    legend: {
      data     : B_FULL,
      top      : 0,
      right    : 0,
      textStyle: { color: textColor, fontSize: 9 },
      itemWidth : 10,
      itemHeight: 7,
    },
    grid: { left: 12, right: 60, bottom: 8, top: 32, containLabel: true },
    xAxis: {
      type     : 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    yAxis: {
      type    : 'category',
      data    : labels,
      axisLabel: { color: textColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    series,
  };

  const onEvents = {
    click: (params: any) => {
      const group = sorted[params.dataIndex];
      if (!group) return;
      const seriesIdx = B_FULL.indexOf(params.seriesName);
      const bucket    = seriesIdx >= 0 ? BUCKETS[seriesIdx] : undefined;
      onNavigate(group.key, groupType, bucket);
    },
  };

  const chartHeight = Math.max(220, sorted.length * 26 + 56);

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ReactECharts option={option} style={{ height: chartHeight }} onEvents={onEvents} />
        <p className="text-xs text-muted-foreground text-center mt-1">Click a bar segment to view those cases</p>
      </CardContent>
    </Card>
  );
}

interface TableProps {
  data      : AgingGroup[];
  title     : string;
  groupType : GroupType;
  onNavigate: (key: string, groupType: GroupType, bucket?: BucketKey) => void;
}

function AgingTable({ data, title, groupType, onNavigate }: TableProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  const CellLink = ({ value, onClick }: { value: number; onClick: () => void }) =>
    value > 0 ? (
      <button
        onClick={onClick}
        className="tabular-nums text-muted-foreground hover:text-primary hover:underline cursor-pointer transition-colors"
      >
        {value.toLocaleString()}
      </button>
    ) : <span className="text-muted-foreground/40">—</span>;

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                {BUCKETS.map((b, i) => (
                  <th key={b} className="text-right px-2 py-2 font-medium whitespace-nowrap"
                    style={{ color: B_COLORS[i] }}>
                    {B_LABELS[i]}
                  </th>
                ))}
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Total</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Avg</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Max</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.key} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-1.5 font-medium max-w-[200px] truncate" title={row.key}>{row.key}</td>
                  {BUCKETS.map(b => (
                    <td key={b} className="text-right px-2 py-1.5">
                      <CellLink
                        value={row.buckets[b] ?? 0}
                        onClick={() => onNavigate(row.key, groupType, b)}
                      />
                    </td>
                  ))}
                  <td className="text-right px-3 py-1.5">
                    <button
                      onClick={() => onNavigate(row.key, groupType)}
                      className="font-bold tabular-nums hover:text-primary hover:underline cursor-pointer transition-colors"
                    >
                      {row.total.toLocaleString()}
                    </button>
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">{row.avgAge}d</td>
                  <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">{row.maxAge}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgingPage() {
  const theme              = useAppStore(s => s.theme);
  const goToCasesWithFilter = useAppStore(s => s.goToCasesWithFilter);

  const { data, isLoading, error } = useQuery({
    queryKey : ['aging'],
    queryFn  : api.aging,
    staleTime: 5 * 60_000,
  });

  const handleNavigate = (key: string, groupType: GroupType, bucket?: BucketKey) => {
    const patch: Partial<CasesFilter> = { status: 'Open' };
    if (groupType === 'department') patch.department  = key;
    else                            patch.moduleLevel = key;
    if (bucket) {
      const { dateFrom, dateTo } = bucketDateRange(bucket);
      patch.dateFrom = dateFrom;
      patch.dateTo   = dateTo;
    }
    goToCasesWithFilter(patch);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="p-6 text-center text-muted-foreground">Failed to load aging data.</div>
  );

  const under30  = data.buckets.find(b => b.bucket === '0-30')?.total ?? 0;
  const over365  = data.buckets.find(b => b.bucket === '365+')?.total ?? 0;
  const over181  = (data.buckets.find(b => b.bucket === '181-365')?.total ?? 0) + over365;
  const snapshot = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h2 className="text-lg font-semibold">Case Aging Analysis</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Age measured from case open date to {snapshot} snapshot · Open cases only · Click any number to view cases
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Total Open Cases"  value={data.totalOpen.toLocaleString()} />
        <KpiCard label="Average Age"       value={`${data.avgAge} days`} sub="mean days open" />
        <KpiCard
          label="Oldest Open Case"
          value={`${data.maxAge} days`}
          sub={data.oldestCase ? `#${data.oldestCase.caseNumber}` : undefined}
          color="text-red-500"
        />
        <KpiCard
          label="Over 181 Days"
          value={over181.toLocaleString()}
          sub={`${data.over181Pct}% of open cases`}
          color="text-orange-400"
        />
        <KpiCard
          label="Recently Opened"
          value={under30.toLocaleString()}
          sub="within last 30 days"
          color="text-green-500"
        />
      </div>

      {/* Bucket Distribution */}
      <Card>
        <CardHeader><CardTitle>Aging Bucket Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {BUCKETS.map((b, i) => {
              const total = data.buckets.find(x => x.bucket === b)?.total ?? 0;
              const pct   = data.totalOpen > 0 ? Math.round(total / data.totalOpen * 100) : 0;
              return (
                <button
                  key={b}
                  onClick={() => {
                    const { dateFrom, dateTo } = bucketDateRange(b);
                    goToCasesWithFilter({ status: 'Open', dateFrom, dateTo });
                  }}
                  className="text-center p-3 rounded-lg border-l-[3px] transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ backgroundColor: B_COLORS[i] + '18', borderColor: B_COLORS[i] }}
                >
                  <div className="text-xs text-muted-foreground mb-1">{b} days</div>
                  <div className="text-xl font-bold tabular-nums">{total.toLocaleString()}</div>
                  <div className="text-xs font-medium mt-0.5" style={{ color: B_COLORS[i] }}>{pct}%</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stacked Bar Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgingGroupChart
          data={data.byDepartment}
          title="Aging by Department"
          theme={theme}
          groupType="department"
          onNavigate={handleNavigate}
        />
        <AgingGroupChart
          data={data.byModuleLevel}
          title="Aging by Level 1 Ticket Type"
          theme={theme}
          groupType="moduleLevel"
          onNavigate={handleNavigate}
        />
      </div>

      {/* Detail Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgingTable data={data.byDepartment}  title="Department Detail"          groupType="department"   onNavigate={handleNavigate} />
        <AgingTable data={data.byModuleLevel} title="Level 1 Ticket Type Detail" groupType="moduleLevel"  onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
