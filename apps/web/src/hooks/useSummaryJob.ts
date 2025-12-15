import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

/**
 * 轮询任务状态的 Hook
 *
 * @param jobId 任务ID
 * @param enabled 是否启用轮询
 */
export function useSummaryJob(jobId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['summaryJob', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const res = await apiClient.api.summaries.jobs[':id'].$get({
        param: { id: jobId.toString() },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data = await res.json();
      return data;
    },
    enabled: enabled && jobId !== null,
    refetchInterval: (data) => {
      // 任务完成或失败时停止轮询
      if (!data?.data) return false;

      const status = data.data.status;

      // 正在进行中的状态：每2秒轮询一次
      if (['pending', 'fetching', 'summarizing'].includes(status)) {
        return 2000;
      }

      // 已完成或失败：停止轮询
      return false;
    },
    retry: false, // 不自动重试，避免过多请求
  });
}
