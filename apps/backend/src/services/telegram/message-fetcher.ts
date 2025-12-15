import type { TelegramClient } from 'telegram';
import type { Api } from 'telegram';
import { RateLimiter } from './rate-limiter';
import { applyQuickFilters } from '../cleaner/message-filter';
import { logger } from '../../utils/logger';

/**
 * 从 Telegram API 拉取的原始消息（简化类型）
 */
interface FetchedMessage {
  id: number;
  text: string;
  date: Date;
  senderId?: string;
  senderName?: string;
  isForwarded: boolean;
  hasMedia: boolean;
  mediaType?: string;
  isFiltered: boolean;
  filterReason?: string;
}

/**
 * 任务进度更新函数类型
 */
type ProgressUpdateFn = (update: {
  progress: number;
  currentMessageId?: number;
  fetchedCount: number;
}) => Promise<void>;

/**
 * 使用激进自适应限流策略拉取消息
 *
 * @param client Telegram 客户端
 * @param groupId Telegram 群组ID（字符串）
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @param onProgress 进度更新回调
 * @param topicId Forum Topic ID（可选，用于Forum群组的子话题）
 * @returns 拉取的消息数组
 */
export async function fetchMessagesWithRateLimit(
  client: TelegramClient,
  groupId: string,
  startTime: Date,
  endTime: Date,
  onProgress?: ProgressUpdateFn,
  topicId?: number
): Promise<FetchedMessage[]> {
  const rateLimiter = new RateLimiter();
  const allMessages: FetchedMessage[] = [];
  let currentDate = endTime;
  let totalBatches = 0;
  let floodWaitCount = 0;
  const startTimestamp = Date.now();

  logger.info('开始拉取消息', {
    groupId,
    period: `${startTime.toISOString()} ~ ${endTime.toISOString()}`,
    initialBatchSize: rateLimiter.getBatchSize(),
  });

  // 先获取频道实体（Telegram 要求）
  let entity: Api.TypeEntityLike;
  try {
    logger.debug('获取频道实体', { groupId });
    entity = await client.getEntity(groupId);
    logger.debug('频道实体获取成功', {
      groupId,
      entityType: entity.className,
    });
  } catch (error) {
    logger.error('获取频道实体失败', {
      error: error instanceof Error ? error.message : String(error),
      groupId,
    });
    throw new Error(
      `无法获取频道信息，请确保已加入该频道/群组: ${groupId}`
    );
  }

  while (currentDate > startTime) {
    try {
      const batchSize = rateLimiter.getBatchSize();
      const waitTime = rateLimiter.calculateWait();

      // 拉取一批消息
      logger.debug('拉取批次', {
        batchNum: totalBatches + 1,
        batchSize,
        currentDate: currentDate.toISOString(),
      });

      const messages = await client.getMessages(groupId, {
        offsetDate: Math.floor(currentDate.getTime() / 1000),
        limit: batchSize,
        reverse: false, // 从新到旧
        ...(topicId && { replyTo: topicId }), // 🔥 如果是Topic，指定replyTo参数
      });

      if (!messages || messages.length === 0) {
        logger.info('没有更多消息');
        break;
      }

      // 转换和过滤消息
      const filteredByTime = messages.filter((msg: Api.Message) => {
        if (!msg.date) return false;
        const msgDate = new Date(msg.date * 1000);
        return msgDate >= startTime && msgDate <= endTime;
      });

      // 并行应用过滤规则
      const processed = await Promise.all(
        filteredByTime.map(async (msg: Api.Message) => {
          const text = msg.message || '';
          const hasMedia = !!msg.media;

          // 应用快速过滤（异步）
          const filterResult = await applyQuickFilters({
            text,
            hasMedia,
            isForwarded: !!msg.fwdFrom,
          });

          return {
            id: msg.id,
            text,
            date: new Date(msg.date! * 1000),
            senderId: msg.peerId?.toString(),
            senderName: '', // 可以从 msg.fromId 获取，但需要额外查询
            isForwarded: !!msg.fwdFrom,
            hasMedia,
            mediaType: msg.media?.className || undefined,
            isFiltered: filterResult.isFiltered,
            filterReason: filterResult.filterReason,
          };
        })
      );

      allMessages.push(...processed);
      totalBatches++;

      // 成功回调
      rateLimiter.onSuccess();

      logger.debug('批次拉取成功', {
        batchNum: totalBatches,
        batchSize: messages.length,
        processedCount: processed.length,
        totalFetched: allMessages.length,
        nextWait: waitTime,
      });

      // 更新进度
      if (onProgress) {
        const progress = calculateProgress(currentDate, startTime, endTime);
        await onProgress({
          progress,
          currentMessageId: messages[messages.length - 1]?.id,
          fetchedCount: allMessages.length,
        });
      }

      // 等待指定时间
      await sleep(waitTime);

      // 更新时间指针
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.date) {
        currentDate = new Date(lastMessage.date * 1000);
      } else {
        break;
      }
    } catch (error: unknown) {
      // 处理 FLOOD_WAIT 错误
      if (isFloodWaitError(error)) {
        const waitSeconds = extractFloodWaitSeconds(error);
        floodWaitCount++;

        logger.warn('遇到 FLOOD_WAIT', {
          groupId,
          waitSeconds,
          batchNum: totalBatches,
          floodWaitCount,
        });

        await rateLimiter.onFloodWait(waitSeconds);
        continue; // 重试当前批次
      }

      // 其他错误直接抛出
      logger.error('拉取消息失败', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
        batchNum: totalBatches,
      });
      throw error;
    }
  }

  const duration = Date.now() - startTimestamp;
  const filteredCount = allMessages.filter((m) => !m.isFiltered).length;

  logger.info('消息拉取完成', {
    groupId,
    totalMessages: allMessages.length,
    filteredMessages: filteredCount,
    totalBatches,
    floodWaitCount,
    duration: `${(duration / 1000).toFixed(1)}s`,
    rateLimiterState: rateLimiter.getState(),
  });

  return allMessages;
}

/**
 * 计算进度（0-100）
 */
function calculateProgress(current: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  const elapsed = end.getTime() - current.getTime();
  return Math.min(100, Math.floor((elapsed / total) * 100));
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 检查是否是 FLOOD_WAIT 错误
 */
function isFloodWaitError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { errorMessage?: string; message?: string };
    const message = err.errorMessage || err.message || '';
    return message.startsWith('FLOOD_WAIT_');
  }
  return false;
}

/**
 * 提取 FLOOD_WAIT 的等待秒数
 */
function extractFloodWaitSeconds(error: unknown): number {
  if (typeof error === 'object' && error !== null) {
    const err = error as { errorMessage?: string; message?: string };
    const message = err.errorMessage || err.message || '';
    const match = message.match(/FLOOD_WAIT_(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return 60; // 默认60秒
}
