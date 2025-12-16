import { db, groups } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { createSummaryJob, executeSummaryJob } from './job-helpers';

/**
 * 定时调度器服务
 * 负责根据群组配置定期生成摘要
 */
class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval = 60 * 1000; // 每分钟检查一次
  private isRunning = false;

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('调度器已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('📅 定时调度器启动', { checkInterval: `${this.checkInterval / 1000}秒` });

    // 立即执行一次检查
    await this.checkAndSchedule();

    // 定期检查
    this.intervalId = setInterval(async () => {
      await this.checkAndSchedule();
    }, this.checkInterval);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('📅 定时调度器已停止');
  }

  /**
   * 检查所有群组并调度任务
   */
  private async checkAndSchedule(): Promise<void> {
    try {
      // 获取所有启用的群组
      const activeGroups = await db.query.groups.findMany({
        where: eq(groups.isActive, true),
      });

      logger.debug('检查定时任务', { activeGroupsCount: activeGroups.length });

      for (const group of activeGroups) {
        await this.checkGroupSchedule(group);
      }
    } catch (error) {
      logger.error('检查定时任务失败', error as Error);
    }
  }

  /**
   * 检查单个群组是否需要生成摘要
   */
  private async checkGroupSchedule(group: typeof groups.$inferSelect): Promise<void> {
    try {
      // 检查是否启用摘要
      if (!group.summaryEnabled) {
        return;
      }

      // 检查上次摘要时间
      const now = new Date();
      const lastSummaryAt = group.lastSummaryAt ? new Date(group.lastSummaryAt) : null;

      // 如果没有上次摘要时间，或者距离上次摘要已经超过间隔时间
      const intervalMs = group.summaryInterval * 60 * 60 * 1000; // 转换为毫秒
      const shouldGenerate =
        !lastSummaryAt || now.getTime() - lastSummaryAt.getTime() >= intervalMs;

      if (shouldGenerate) {
        logger.info('🔔 触发定时摘要任务', {
          groupId: group.id,
          groupTitle: group.title,
          lastSummaryAt: lastSummaryAt?.toISOString() || 'never',
          interval: `${group.summaryInterval}小时`,
        });

        // 计算时间范围：上次摘要时间到现在
        const periodStart = lastSummaryAt || new Date(now.getTime() - intervalMs);
        const periodEnd = now;

        // 创建定时任务
        const job = await createSummaryJob(
          group.id,
          periodStart,
          periodEnd,
          'scheduled', // 标记为定时任务
        );

        logger.info('✅ 定时摘要任务已创建', {
          jobId: job.id,
          groupId: group.id,
          groupTitle: group.title,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        });

        // 异步执行任务
        executeSummaryJob(job.id).catch((err) => {
          logger.error('定时任务执行失败', {
            error: err instanceof Error ? err.message : String(err),
            jobId: job.id,
            groupId: group.id,
          });
        });

        // 更新群组的最后摘要时间
        await db.update(groups).set({ lastSummaryAt: now }).where(eq(groups.id, group.id));
      }
    } catch (error) {
      logger.error('检查群组定时任务失败', {
        error: error instanceof Error ? error.message : String(error),
        groupId: group.id,
        groupTitle: group.title,
      });
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus(): { isRunning: boolean; checkInterval: number } {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
    };
  }
}

// 导出单例
export const schedulerService = new SchedulerService();
