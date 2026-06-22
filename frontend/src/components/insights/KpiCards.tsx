import { TrendingUp, AlertCircle, Inbox, Activity, FolderOpen, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { KpiData } from '@/types';

interface Props { kpi: KpiData; }

export default function KpiCards({ kpi }: Props) {
  const closed = kpi.total - kpi.open;

  const cards = [
    {
      label: 'Total Cases',
      value: kpi.total.toLocaleString(),
      sub: null,
      icon: FolderOpen,
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-50 dark:bg-slate-900/40',
    },
    {
      label: 'Open Cases',
      value: kpi.open.toLocaleString(),
      sub: `${kpi.openRate}% of total`,
      icon: Inbox,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Closed Cases',
      value: closed.toLocaleString(),
      sub: `${kpi.total > 0 ? Math.round(closed / kpi.total * 100) : 0}% of total`,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'New Cases',
      value: kpi.newCases.toLocaleString(),
      sub: null,
      icon: TrendingUp,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    },
    {
      label: 'Escalated',
      value: kpi.escalated.toLocaleString(),
      sub: null,
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Open Rate',
      value: `${kpi.openRate}%`,
      sub: `${kpi.open.toLocaleString()} / ${kpi.total.toLocaleString()}`,
      icon: Activity,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(({ label, value, sub, icon: Icon, color, bg }) => (
        <Card key={label}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs">{label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-foreground leading-tight">{value}</div>
                {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
              </div>
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={17} className={color} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
