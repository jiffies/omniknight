import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { SummaryJob } from '@omniknight/shared';
import { apiClient } from '../lib/api-client';

/**
 * 请求浏览器通知权限
 */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * 发送浏览器通知
 */
function sendNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
    });
  }
}

/**
 * 获取所有任务列表
 */
export function useTasks() {
  const previousTasksRef = useRef<Map<number, string>>(new Map());

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
  });

  // 请求通知权限(仅在挂载时执行一次)
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // 监听任务状态变化,发送通知
  useEffect(() => {
    if (!query.data?.data) return;

    const tasks = query.data.data as SummaryJob[];

    for (const task of tasks) {
      const previousStatus = previousTasksRef.current.get(task.id);

      // 如果任务从非completed状态变为completed状态,发送通知
      if (
        previousStatus &&
        previousStatus !== 'completed' &&
        task.status === 'completed'
      ) {
        sendNotification('任务已完成', `任务 #${task.id} 已成功完成`);
      }

      // 如果任务从非failed状态变为failed状态,发送通知
      if (previousStatus && previousStatus !== 'failed' && task.status === 'failed') {
        sendNotification('任务失败', `任务 #${task.id} 执行失败`);
      }

      // 更新任务状态记录
      previousTasksRef.current.set(task.id, task.status);
    }
  }, [query.data]);

  return query;
}
