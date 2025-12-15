import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useSystemConfig() {
  return useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const res = await apiClient.api['system-config'].$get();
      if (!res.ok) throw new Error('Failed to fetch system config');
      return res.json();
    },
  });
}
