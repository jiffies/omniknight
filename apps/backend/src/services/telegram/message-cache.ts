import { logger } from '../../utils/logger';

/**
 * 拉取的消息（简化类型）
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
 * 格式化时间为本地时间字符串
 */
function formatLocalTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * 缓存条目
 */
interface CacheEntry {
  messages: FetchedMessage[];
  timestamp: number;
  groupId: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * 消息缓存管理器
 * 用于缓存拉取的消息，避免重复拉取
 */
class MessageCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 10 * 60 * 1000; // 10分钟

  /**
   * 生成缓存键
   * 将时间向下取整到10分钟粒度，以提高缓存命中率
   */
  private getCacheKey(groupId: number, periodStart: Date, periodEnd: Date): string {
    // 10分钟 = 600000 毫秒
    const granularity = 10 * 60 * 1000;

    // 将开始和结束时间都向下取整到10分钟
    const alignedStart = Math.floor(periodStart.getTime() / granularity) * granularity;
    const alignedEnd = Math.floor(periodEnd.getTime() / granularity) * granularity;

    return `${groupId}_${alignedStart}_${alignedEnd}`;
  }

  /**
   * 检查缓存是否有效
   */
  private isValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age < this.TTL;
  }

  /**
   * 获取缓存的消息
   */
  get(groupId: number, periodStart: Date, periodEnd: Date): FetchedMessage[] | null {
    const granularity = 10 * 60 * 1000;
    const alignedStart = Math.floor(periodStart.getTime() / granularity) * granularity;
    const alignedEnd = Math.floor(periodEnd.getTime() / granularity) * granularity;
    const key = this.getCacheKey(groupId, periodStart, periodEnd);
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug('缓存未命中', {
        groupId,
        key,
        原始时间: `${formatLocalTime(periodStart)} ~ ${formatLocalTime(periodEnd)}`,
        对齐时间: `${formatLocalTime(new Date(alignedStart))} ~ ${formatLocalTime(new Date(alignedEnd))}`,
      });
      return null;
    }

    if (!this.isValid(entry)) {
      logger.debug('缓存已过期，删除', { groupId, key, age: Date.now() - entry.timestamp });
      this.cache.delete(key);
      return null;
    }

    logger.info('✅ 命中消息缓存', {
      groupId,
      messageCount: entry.messages.length,
      cacheAge: `${Math.round((Date.now() - entry.timestamp) / 1000)}秒`,
      原始时间: `${formatLocalTime(periodStart)} ~ ${formatLocalTime(periodEnd)}`,
      对齐时间: `${formatLocalTime(new Date(alignedStart))} ~ ${formatLocalTime(new Date(alignedEnd))}`,
    });

    return entry.messages;
  }

  /**
   * 设置缓存
   */
  set(groupId: number, periodStart: Date, periodEnd: Date, messages: FetchedMessage[]): void {
    const granularity = 10 * 60 * 1000;
    const alignedStart = Math.floor(periodStart.getTime() / granularity) * granularity;
    const alignedEnd = Math.floor(periodEnd.getTime() / granularity) * granularity;
    const key = this.getCacheKey(groupId, periodStart, periodEnd);

    this.cache.set(key, {
      messages,
      timestamp: Date.now(),
      groupId,
      periodStart,
      periodEnd,
    });

    logger.info('💾 消息已缓存', {
      groupId,
      messageCount: messages.length,
      key,
      ttl: `${this.TTL / 1000}秒`,
      原始时间: `${formatLocalTime(periodStart)} ~ ${formatLocalTime(periodEnd)}`,
      对齐时间: `${formatLocalTime(new Date(alignedStart))} ~ ${formatLocalTime(new Date(alignedEnd))}`,
    });

    // 设置自动清理
    setTimeout(() => {
      if (this.cache.has(key)) {
        logger.debug('自动清理过期缓存', { key });
        this.cache.delete(key);
      }
    }, this.TTL);
  }

  /**
   * 清除指定群组的缓存
   */
  clearGroup(groupId: number): void {
    let clearedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.groupId === groupId) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info('清除群组缓存', { groupId, clearedCount });
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.info('清除所有缓存', { count });
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const entries = Array.from(this.cache.entries());
    return {
      size: this.cache.size,
      entries: entries.map(([key, entry]) => ({
        key,
        groupId: entry.groupId,
        messageCount: entry.messages.length,
        age: Date.now() - entry.timestamp,
        isValid: this.isValid(entry),
      })),
    };
  }
}

export const messageCache = new MessageCache();
