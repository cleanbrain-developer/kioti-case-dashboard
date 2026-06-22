import { TrendingUp, AlertCircle, Inbox, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { KpiData } from '@/types';

interface Props { kpi: KpiData; }

export default function KpiCards({ kpi }: Props) {
  const cards = [
    { label: 'Open Cases',   value: kpi.open.toLocaleString(),      icon: Inbox,       color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'New Cases',    value: kpi.newCases.toLocaleString(),   icon: TrendingUp,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Escalated',   value: kpi.escalated.toLocaleString(),  icon: AlertCircle, color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'Open Rate',   value: `${kpi.openRate}%`,              icon: Activity,    color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/30' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle>{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">{value}</span>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={20} className={color} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
