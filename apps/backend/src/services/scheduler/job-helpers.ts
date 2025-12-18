import { db, groups, summaryJobs } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { generateSummary } from '../ai/summarizer';
import {
  sendTaskCompletedNotification,
  sendTaskFailedNotification,
} from '../push/push-service';

/**
 * 创建摘要任务
 */
export async function createSummaryJob(
  groupId: number,
  periodStart: Date,
  periodEnd: Date,
  taskType: 'manual' | 'scheduled' = 'manual',
) {
  const [job] = await db
    .insert(summaryJobs)
    .values({
      groupId,
      periodStart,
      periodEnd,
      taskType,
      status: 'pending',
      progress: 0,
      fetchedCount: 0,
      retryCount: 0,
      scheduledAt: new Date(),
    })
    .returning();

  if (!job) {
    throw new Error('Failed to create summary job');
  }

  logger.info('创建摘要任务', {
    jobId: job.id,
    groupId,
    taskType,
    period: `${periodStart.toISOString()} ~ ${periodEnd.toISOString()}`,
  });

  return job;
}

/**
 * 更新任务进度
 */
export async function updateJobProgress(
  jobId: number,
  update: {
    status?: 'pending' | 'fetching' | 'summarizing' | 'completed' | 'failed';
    progress?: number;
    currentMessageId?: number;
    fetchedCount?: number;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
  },
) {
  await db.update(summaryJobs).set(update).where(eq(summaryJobs.id, jobId));
}

/**
 * 执行摘要任务
 */
export async function executeSummaryJob(jobId: number): Promise<void> {
  const job = await db.query.summaryJobs.findFirst({
    where: eq(summaryJobs.id, jobId),
  });

  if (!job) {
    logger.error('任务不存在', { jobId });
    return;
  }

  try {
    logger.info('🚀 开始执行任务', {
      jobId,
      groupId: job.groupId,
      taskType: job.taskType,
    });

    // 更新状态为进行中，记录开始时间
    logger.info('📝 更新任务状态: pending → fetching');
    await updateJobProgress(jobId, {
      status: 'fetching',
      progress: 0,
      startedAt: new Date(),
    });

    // 执行摘要生成（带进度回调）
    logger.info('🔄 开始执行摘要生成流程');
    const summary = await generateSummary(
      job.groupId,
      job.periodStart,
      job.periodEnd,
      async (progressUpdate) => {
        const newStatus = progressUpdate.progress < 100 ? 'fetching' : 'summarizing';
        logger.info('📊 任务进度更新', {
          jobId,
          status: newStatus,
          progress: `${progressUpdate.progress}%`,
          fetchedCount: progressUpdate.fetchedCount,
        });

        await updateJobProgress(jobId, {
          status: newStatus,
          progress: progressUpdate.progress,
          fetchedCount: progressUpdate.fetchedCount,
        });
      },
    );

    if (!summary) {
      logger.warn('⚠️ 消息数量不足，无法生成总结', { jobId });
      throw new Error('Not enough messages to generate summary');
    }

    // 更新状态为完成，记录完成时间
    logger.info('📝 更新任务状态: summarizing → completed');
    await updateJobProgress(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
    });

    logger.info('✅ 任务执行成功', {
      jobId,
      summaryId: summary.id,
      title: summary.title,
    });

    // 发送推送通知
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, job.groupId),
    });
    if (group) {
      await sendTaskCompletedNotification(group.title, job.taskType, jobId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ 任务执行失败', {
      error: errorMessage,
      jobId,
      groupId: job.groupId,
    });

    // 更新状态为失败，记录完成时间
    logger.info('📝 更新任务状态: → failed');
    await updateJobProgress(jobId, {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    });

    // 发送推送通知
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, job.groupId),
    });
    if (group) {
      await sendTaskFailedNotification(group.title, job.taskType, jobId, errorMessage);
    }
  }
}
