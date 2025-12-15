import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

/**
 * 获取所有任务列表
 */
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await apiClient.api.summaries.jobs.$get();
      if (!res.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return await res.json();
    },
    refetchInterval: 3000, // 每3秒刷新一次任务列表
  });
}
