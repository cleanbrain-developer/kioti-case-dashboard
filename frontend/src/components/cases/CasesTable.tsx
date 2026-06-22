import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import type { CaseRecord, CasesResponse } from '@/types';

interface Props { data: CasesResponse | undefined; isLoading: boolean; onPageChange: () => void; }

const STATUS_VARIANT: Record<string, any> = {
  Open     : 'success',
  New      : 'default',
  Escalated: 'destructive',
  Closed   : 'outline',
};
const PRIORITY_VARIANT: Record<string, any> = {
  High  : 'destructive',
  Medium: 'warning',
  Low   : 'outline',
};

const COLUMNS = [
  { key: 'CaseNumber', label: 'Case #',          sortable: true },
  { key: 'Subject',    label: 'Subject',          sortable: true },
  { key: 'Status',     label: 'Status',           sortable: true },
  { key: 'Priority',   label: 'Priority',         sortable: true },
  { key: 'dept',       label: 'Department',       sortable: true },
  { key: 'pic',        label: 'Person In Charge', sortable: true },
  { key: 'CreatedDate',label: 'Created',          sortable: true },
];

export default function CasesTable({ data, isLoading, onPageChange }: Props) {
  const { filter, setFilter } = useAppStore();
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });
  const instanceUrl = health?.instanceUrl?.replace(/\/$/, '') ?? 'https://login.salesforce.com';
  const { sortField, sortDir, page, pageSize } = filter;

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (key: string) => {
    if (sortField === key) {
      setFilter({ sortDir: sortDir === 'DESC' ? 'ASC' : 'DESC', page: 1 });
    } else {
      setFilter({ sortField: key, sortDir: 'DESC', page: 1 });
    }
    onPageChange();
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortField !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'DESC' ? <ArrowDown size={12} /> : <ArrowUp size={12} />;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 border border-border rounded-xl">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>Total <strong className="text-foreground">{totalCount.toLocaleString()}</strong> cases</span>
        {data?.source === 'sf' && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">Live from Salesforce</span>}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {COLUMNS.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {col.sortable ? (
                      <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        {col.label} <SortIcon col={col.key} />
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.records ?? []).map((r: CaseRecord) => (
                <tr key={r.Id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary font-medium whitespace-nowrap">
                    <a
                      href={`${instanceUrl}/${r.Id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {r.CaseNumber}
                    </a>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-foreground">{r.Subject || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.Status ? <Badge variant={STATUS_VARIANT[r.Status] ?? 'outline'}>{r.Status}</Badge> : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.Priority ? <Badge variant={PRIORITY_VARIANT[r.Priority] ?? 'outline'}>{r.Priority}</Badge> : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{r.department || '—'}</td>
                  <td className="px-4 py-3 text-primary whitespace-nowrap">{r._picName || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{formatDate(r.CreatedDate)}</td>
                </tr>
              ))}
              {!isLoading && (data?.records ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No cases found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1}
              onClick={() => { setFilter({ page: page - 1 }); onPageChange(); }}
            >
              <ChevronLeft size={14} />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'} size="sm"
                  onClick={() => { setFilter({ page: p }); onPageChange(); }}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages}
              onClick={() => { setFilter({ page: page + 1 }); onPageChange(); }}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
