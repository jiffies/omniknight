import { zValidator } from '@hono/zod-validator';
import { db, summaries, summaryJobs } from '@omniknight/db';
import { generateSummarySchema, querySummariesSchema } from '@omniknight/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createSummaryJob, executeSummaryJob } from '../services/scheduler/job-helpers';
import { logger } from '../utils/logger';

const app = new Hono();

// GET /api/summaries - 获取总结列表
app.get('/', zValidator('query', querySummariesSchema), async (c) => {
  const { groupId, limit, offset } = c.req.valid('query');

  const whereClauses = groupId ? [eq(summaries.groupId, groupId)] : [];

  const results = await db.query.summaries.findMany({
    where: whereClauses.length > 0 ? and(...whereClauses) : undefined,
    orderBy: [desc(summaries.periodEnd)],
    limit,
    offset,
    with: {
      group: true,
    },
  });

  return c.json({ data: results });
});

// POST /api/summaries/generate - 手动触发总结生成（异步）
app.post('/generate', zValidator('json', generateSummarySchema), async (c) => {
  const { groupId, periodStart, periodEnd } = c.req.valid('json');

  logger.info('手动触发总结生成', {
    groupId,
    periodStart,
    periodEnd,
  });

  try {
    // 创建任务
    const job = await createSummaryJob(groupId, new Date(periodStart), new Date(periodEnd));

    // 异步执行（不阻塞响应）
    executeSummaryJob(job.id).catch((err) => {
      logger.error('任务执行失败', err);
    });

    // 立即返回任务ID
    return c.json({ data: { jobId: job.id } }, 202);
  } catch (error) {
    logger.error('创建任务失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

// GET /api/summaries/jobs - 获取所有任务列表
app.get('/jobs', async (c) => {
  const jobs = await db
    .select()
    .from(summaryJobs)
    .orderBy(desc(summaryJobs.scheduledAt))
    .limit(100);

  return c.json({ data: jobs });
});

// GET /api/summaries/jobs/:id - 查询任务状态
app.get('/jobs/:id', async (c) => {
  const jobId = Number.parseInt(c.req.param('id'), 10);

  const job = await db.select().from(summaryJobs).where(eq(summaryJobs.id, jobId)).limit(1);

  if (!job || job.length === 0) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json({ data: job[0] });
});

// DELETE /api/summaries/jobs/:id - 删除任务
app.delete('/jobs/:id', async (c) => {
  const jobId = Number.parseInt(c.req.param('id'), 10);

  try {
    // 检查任务是否存在
    const job = await db.select().from(summaryJobs).where(eq(summaryJobs.id, jobId)).limit(1);

    if (!job || job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // 删除任务
    await db.delete(summaryJobs).where(eq(summaryJobs.id, jobId));

    logger.info('任务已删除', { jobId });
    return c.json({ message: 'Job deleted successfully' });
  } catch (error) {
    logger.error('删除任务失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to delete job' }, 500);
  }
});

// GET /api/summaries/:id - 获取总结详情
app.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const summary = await db.query.summaries.findFirst({
    where: eq(summaries.id, id),
    with: {
      group: true,
    },
  });

  if (!summary) {
    return c.json({ error: 'Summary not found' }, 404);
  }

  return c.json({ data: summary });
});

export default app;
