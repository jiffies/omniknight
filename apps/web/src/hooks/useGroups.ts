import { useQuery } from '@tanstack/react-query';
import { apiClient, handleResponse } from '../lib/api-client';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await apiClient.api.groups.$get();
      return handleResponse<{ data: any[] }>(res);
    },
  });
}
