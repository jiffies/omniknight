import type { SummaryWithGroup } from '@omniknight/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient, handleResponse } from '../lib/api-client';

export function useSummaries(groupId?: number, limit = 20) {
  return useQuery({
    queryKey: ['summaries', groupId, limit],
    queryFn: async () => {
      const query: Record<string, string> = { limit: limit.toString() };
      if (groupId) {
        query.groupId = groupId.toString();
      }

      const res = await apiClient.api.summaries.$get({ query });
      return handleResponse<{ data: SummaryWithGroup[] }>(res);
    },
  });
}
