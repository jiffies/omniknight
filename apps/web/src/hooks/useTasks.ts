import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import type { SummaryJob } from '@omniknight/shared';
import { apiClient } from '../lib/api-client';
import { useGroups } from './useGroups';

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
function sendNotification(title: string, body: string, tag?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag, // 使用tag避免同一任务的多个通知
    });
  }
}

/**
 * 获取所有任务列表
 */
export function useTasks() {
  const previousTasksRef = useRef<Map<number, string>>(new Map());
  const isInitializedRef = useRef(false);
  const { data: groupsData } = useGroups();

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

  // 获取群组名称
  const getGroupName = useCallback(
    (groupId: number): string => {
      const groups = groupsData?.data || [];
      const group = groups.find((g: { id: number; title: string }) => g.id === groupId);
      return group?.title || `群组 #${groupId}`;
    },
    [groupsData],
  );

  // 获取任务类型文本
  const getTaskTypeText = useCallback((taskType: string): string => {
    return taskType === 'scheduled' ? '定时任务' : '手动任务';
  }, []);

  // 请求通知权限(仅在挂载时执行一次)
  useEffect(() => {
    requestNotificationPermission();
    console.log(
      '[通知] 通知权限状态:',
      'Notification' in window ? Notification.permission : '不支持',
    );
  }, []);

  // 监听任务状态变化,发送通知
  useEffect(() => {
    if (!query.data?.data) return;

    const tasks = query.data.data as SummaryJob[];

    // 首次加载时只记录状态，不发送通知
    if (!isInitializedRef.current) {
      for (const task of tasks) {
        previousTasksRef.current.set(task.id, task.status);
      }
      isInitializedRef.current = true;
      console.log('[通知] 初始化完成，已记录', tasks.length, '个任务的状态');
      return;
    }

    // 检测状态变化并发送通知
    for (const task of tasks) {
      const previousStatus = previousTasksRef.current.get(task.id);

      // 新任务（之前不存在）- 只记录状态，不发送通知
      if (previousStatus === undefined) {
        previousTasksRef.current.set(task.id, task.status);
        console.log(`[通知] 发现新任务 #${task.id}，状态: ${task.status}`);
        continue;
      }

      // 任务从非completed状态变为completed状态,发送通知
      if (previousStatus !== 'completed' && task.status === 'completed') {
        const groupName = getGroupName(task.groupId);
        const taskType = getTaskTypeText(task.taskType);
        console.log(`[通知] 任务 #${task.id} 已完成，发送通知`);
        sendNotification(
          `✅ ${taskType}已完成`,
          `「${groupName}」的总结已生成完成`,
          `task-${task.id}`,
        );
      }

      // 任务从非failed状态变为failed状态,发送通知
      if (previousStatus !== 'failed' && task.status === 'failed') {
        const groupName = getGroupName(task.groupId);
        const taskType = getTaskTypeText(task.taskType);
        const errorMsg = task.errorMessage ? `\n原因：${task.errorMessage}` : '';
        console.log(`[通知] 任务 #${task.id} 失败，发送通知`);
        sendNotification(
          `❌ ${taskType}失败`,
          `「${groupName}」的总结生成失败${errorMsg}`,
          `task-${task.id}`,
        );
      }

      // 更新任务状态记录
      previousTasksRef.current.set(task.id, task.status);
    }
  }, [query.data, getGroupName, getTaskTypeText]);

  return query;
}
