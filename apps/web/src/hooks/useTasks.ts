import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

/**
 * 获取所有任务列表
 * 注意：通知功能已迁移到 Web Push（后端推送），这里只负责数据查询
 */
export function useTasks() {
  const query = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await apiClient.api.summaries.jobs.$get();
      if (!res.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return await res.json();
    },
    refetchInterval: 3000, // 每3秒刷新一次任务列表
    refetchOnWindowFocus: true, // 窗口获得焦点时立即刷新
  });

  return query;
}
