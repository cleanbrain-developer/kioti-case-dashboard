import { TrendingUp, AlertCircle, Inbox, Activity, FolderOpen, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { KpiData } from '@/types';

interface Props { kpi: KpiData; }

export default function KpiCards({ kpi }: Props) {
  const closed = kpi.total - kpi.open;

  const cards = [
    {
      label   : 'Total Cases',
      value   : kpi.total.toLocaleString(),
      sub     : null,
      Icon    : FolderOpen,
      numCls  : 'text-slate-200',
      iconCls : 'text-slate-400',
      iconBg  : 'bg-slate-700/60',
    },
    {
      label   : 'Open Cases',
      value   : kpi.open.toLocaleString(),
      sub     : `${kpi.openRate}% of total`,
      Icon    : Inbox,
      numCls  : 'text-blue-400',
      iconCls : 'text-blue-400',
      iconBg  : 'bg-blue-500/15',
    },
    {
      label   : 'Closed Cases',
      value   : closed.toLocaleString(),
      sub     : `${kpi.total > 0 ? Math.round(closed / kpi.total * 100) : 0}% of total`,
      Icon    : CheckCircle2,
      numCls  : 'text-emerald-400',
      iconCls : 'text-emerald-400',
      iconBg  : 'bg-emerald-500/15',
    },
    {
      label   : 'New Cases',
      value   : kpi.newCases.toLocaleString(),
      sub     : null,
      Icon    : TrendingUp,
      numCls  : 'text-cyan-400',
      iconCls : 'text-cyan-400',
      iconBg  : 'bg-cyan-500/15',
    },
    {
      label   : 'Escalated',
      value   : kpi.escalated.toLocaleString(),
      sub     : null,
      Icon    : AlertCircle,
      numCls  : 'text-red-400',
      iconCls : 'text-red-400',
      iconBg  : 'bg-red-500/15',
    },
    {
      label   : 'Open Rate',
      value   : `${kpi.openRate}%`,
      sub     : `${kpi.open.toLocaleString()} / ${kpi.total.toLocaleString()}`,
      Icon    : Activity,
      numCls  : 'text-amber-400',
      iconCls : 'text-amber-400',
      iconBg  : 'bg-amber-500/15',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map(({ label, value, sub, Icon, numCls, iconCls, iconBg }) => (
        <Card key={label} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Icon box — top */}
            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={iconCls} />
            </div>
            {/* Value — colored, prominent */}
            <div className={`text-2xl font-bold leading-tight tabular-nums ${numCls}`}>{value}</div>
            {/* Label */}
            <div className="text-xs font-medium text-muted-foreground mt-1 leading-tight">{label}</div>
            {/* Sub-label */}
            {sub && <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
