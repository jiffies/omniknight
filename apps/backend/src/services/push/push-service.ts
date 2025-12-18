import webpush from 'web-push';
import { db, pushSubscriptions } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// 配置 VAPID
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  logger.info('Web Push VAPID 已配置');
} else {
  logger.warn('Web Push VAPID 未配置，推送通知将不可用');
}

/**
 * 检查推送服务是否可用
 */
export function isPushEnabled(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/**
 * 获取 VAPID 公钥
 */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY || null;
}

/**
 * 保存推送订阅
 */
export async function saveSubscription(subscription: {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}) {
  // 检查是否已存在
  const existing = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, subscription.endpoint),
  });

  if (existing) {
    // 更新现有订阅
    await db
      .update(pushSubscriptions)
      .set({
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: subscription.userAgent,
        updatedAt: new Date(),
      })
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    logger.info('更新推送订阅', { endpoint: `${subscription.endpoint.slice(0, 50)}...` });
    return existing;
  }

  // 创建新订阅
  const [newSub] = await db
    .insert(pushSubscriptions)
    .values({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: subscription.userAgent,
    })
    .returning();

  logger.info('创建推送订阅', { id: newSub?.id });
  return newSub;
}

/**
 * 删除推送订阅
 */
export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  logger.info('删除推送订阅', { endpoint: `${endpoint.slice(0, 50)}...` });
}

/**
 * 推送通知数据结构
 */
interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * 向所有订阅者发送推送通知
 */
export async function sendPushNotificationToAll(notification: PushNotificationData) {
  if (!isPushEnabled()) {
    logger.warn('推送服务未启用，跳过发送');
    return { success: 0, failed: 0 };
  }

  const subscriptions = await db.query.pushSubscriptions.findMany();

  if (subscriptions.length === 0) {
    logger.debug('没有推送订阅者，跳过推送（可在设置页面启用推送通知）');
    return { success: 0, failed: 0 };
  }

  logger.info('发送推送通知', {
    title: notification.title,
    subscriberCount: subscriptions.length,
  });

  let success = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(notification),
      );
      success++;
    } catch (error) {
      failed++;
      const statusCode = (error as { statusCode?: number }).statusCode;

      // 如果订阅已过期或无效，删除它
      if (statusCode === 404 || statusCode === 410) {
        logger.info('订阅已过期，删除', { endpoint: `${sub.endpoint.slice(0, 50)}...` });
        await removeSubscription(sub.endpoint);
      } else {
        logger.error('发送推送失败', {
          error: error instanceof Error ? error.message : String(error),
          statusCode,
        });
      }
    }
  }

  logger.info('推送发送完成', { success, failed });
  return { success, failed };
}

/**
 * 发送任务完成通知
 */
export async function sendTaskCompletedNotification(
  groupName: string,
  taskType: 'manual' | 'scheduled',
  jobId: number,
) {
  const taskTypeText = taskType === 'scheduled' ? '定时任务' : '手动任务';

  await sendPushNotificationToAll({
    title: `${taskTypeText}已完成`,
    body: `「${groupName}」的总结已生成完成`,
    icon: '/favicon.ico',
    tag: `task-completed-${jobId}`,
    data: {
      type: 'task-completed',
      jobId,
      url: '/tasks',
    },
  });
}

/**
 * 发送任务失败通知
 */
export async function sendTaskFailedNotification(
  groupName: string,
  taskType: 'manual' | 'scheduled',
  jobId: number,
  errorMessage?: string,
) {
  const taskTypeText = taskType === 'scheduled' ? '定时任务' : '手动任务';
  const body = errorMessage
    ? `「${groupName}」的总结生成失败\n原因：${errorMessage}`
    : `「${groupName}」的总结生成失败`;

  await sendPushNotificationToAll({
    title: `${taskTypeText}失败`,
    body,
    icon: '/favicon.ico',
    tag: `task-failed-${jobId}`,
    data: {
      type: 'task-failed',
      jobId,
      url: '/tasks',
    },
  });
}
