import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/appStore';

export default function CasesFilter({ onApply }: { onApply: () => void }) {
  const [open, setOpen] = useState(true);
  const { filter, setFilter, resetFilter } = useAppStore();

  const { data: health } = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });
  const picklists = health?.picklists ?? {};
  const statusOpts = (picklists['Status'] ?? []).map((v: any) => v.value);

  const f = (id: keyof typeof filter) => filter[id] as string;

  const handleApply = () => { setFilter({ page: 1 }); onApply(); };
  const handleClear = () => { resetFilter(); onApply(); };

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-foreground"
      >
        <Filter size={15} className="text-muted-foreground" />
        Filters
        {open ? <ChevronUp size={15} className="ml-auto text-muted-foreground" /> : <ChevronDown size={15} className="ml-auto text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search</label>
              <Input
                placeholder="Subject / Case #"
                value={f('search')}
                onChange={e => setFilter({ search: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleApply()}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={f('status')}
                onChange={e => setFilter({ status: e.target.value })}
              >
                <option value="">All Statuses</option>
                {statusOpts.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={f('priority')}
                onChange={e => setFilter({ priority: e.target.value })}
              >
                <option value="">All Priorities</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</label>
              <Input
                placeholder="Department…"
                value={f('department')}
                onChange={e => setFilter({ department: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Person In Charge</label>
              <Input
                placeholder="Person name…"
                value={f('personInCharge')}
                onChange={e => setFilter({ personInCharge: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created From</label>
              <Input
                type="date"
                value={f('dateFrom')}
                onChange={e => setFilter({ dateFrom: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created To</label>
              <Input
                type="date"
                value={f('dateTo')}
                onChange={e => setFilter({ dateTo: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleApply}>Apply Filters</Button>
            <Button variant="outline" onClick={handleClear}>Clear All</Button>
            {filter.personInCharge && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                PIC: {filter.personInCharge}
              </span>
            )}
            {filter.department && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                Dept: {filter.department}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
