import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useFilterRules() {
  return useQuery({
    queryKey: ['filter-rules'],
    queryFn: async () => {
      const res = await apiClient.api['filter-rules'].$get();
      if (!res.ok) throw new Error('Failed to fetch filter rules');
      return res.json();
    },
  });
}
