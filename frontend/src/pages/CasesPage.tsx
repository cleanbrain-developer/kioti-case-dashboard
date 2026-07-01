import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import CasesFilter from '@/components/cases/CasesFilter';
import CasesTable from '@/components/cases/CasesTable';

export default function CasesPage() {
  const { filter } = useAppStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cases', filter],
    queryFn : () => api.cases(filter),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="p-6 space-y-4">
      <CasesFilter onApply={() => refetch()} />
      <CasesTable data={data} isLoading={isLoading} onPageChange={() => refetch()} />
    </div>
  );
}
