import { zValidator } from '@hono/zod-validator';
import { db, groups, summaries, telegramAccounts } from '@omniknight/db';
import { createGroupSchema, updateGroupSchema } from '@omniknight/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createSummaryJob, executeSummaryJob } from '../services/scheduler/job-helpers';
import { logger } from '../utils/logger';

const app = new Hono();

async function createInitialSummaryJob(group: typeof groups.$inferSelect): Promise<void> {
  const now = new Date();
  const intervalMs = group.summaryInterval * 60 * 60 * 1000;
  const periodStart = new Date(now.getTime() - intervalMs);
  const job = await createSummaryJob(group.id, periodStart, now, 'scheduled');

  await db.update(groups).set({ lastSummaryAt: now }).where(eq(groups.id, group.id));

  logger.info('新建群组初始摘要任务已创建', {
    groupId: group.id,
    jobId: job.id,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
  });

  executeSummaryJob(job.id).catch((err) => {
    logger.error('新建群组初始摘要任务执行失败', {
      error: err instanceof Error ? err.message : String(err),
      jobId: job.id,
      groupId: group.id,
    });
  });
}

// GET /api/groups - 获取所有群组列表
app.get('/', async (c) => {
  const allGroups = await db.query.groups.findMany({
    with: {
      account: true, // 关联查询账号信息
    },
    orderBy: (groups, { desc }) => [desc(groups.updatedAt)],
  });

  // 为每个群组添加统计信息
  const groupsWithStats = await Promise.all(
    allGroups.map(async (group) => {
      // 消息不再存储在数据库中，使用按需拉取模式
      const [summaryCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(summaries)
        .where(eq(summaries.groupId, group.id));

      return {
        ...group,
        messageCount: 0, // 消息不再存储
        summaryCount: summaryCountResult?.count || 0,
        // 添加账号信息
        accountInfo: group.account
          ? {
              id: group.account.id,
              phoneNumber: group.account.phoneNumber,
              username: group.account.username,
              isConnected: group.account.isConnected,
            }
          : null,
      };
    }),
  );

  return c.json({ data: groupsWithStats });
});

// GET /api/groups/:id - 获取单个群组详情
app.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, id),
  });

  if (!group) {
    return c.json({ error: 'Group not found' }, 404);
  }

  return c.json({ data: group });
});

// POST /api/groups - 创建群组
app.post(
  '/',
  zValidator('json', createGroupSchema, (result, c) => {
    if (!result.success && 'error' in result) {
      logger.error('群组数据验证失败', { errors: result.error });
      return c.json({ error: 'Validation failed', details: result.error }, 400);
    }
  }),
  async (c) => {
    try {
      logger.info('收到创建群组请求');
      const data = c.req.valid('json');
      logger.info('群组数据验证通过', { data });

      // 验证账号存在
      const account = await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.id, data.accountId),
      });

      if (!account) {
        logger.error('账号不存在', { accountId: data.accountId });
        return c.json({ error: 'Account not found' }, 404);
      }

      // 检查群组是否已存在（基于 telegram_id + topic_id 组合）
      const existingGroup = await db.query.groups.findFirst({
        where: (groups, { eq, and, isNull }) =>
          data.topicId
            ? and(eq(groups.telegramId, data.telegramId), eq(groups.topicId, data.topicId))
            : and(eq(groups.telegramId, data.telegramId), isNull(groups.topicId)),
      });

      if (existingGroup) {
        logger.warn('群组已存在', {
          telegramId: data.telegramId,
          topicId: data.topicId,
          groupId: existingGroup.id,
        });
        return c.json({ error: 'Group already exists', data: existingGroup }, 409);
      }

      const [group] = await db
        .insert(groups)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!group) {
        return c.json({ error: 'Failed to create group' }, 500);
      }

      logger.info('群组已创建', {
        groupId: group.id,
        title: group.title,
        accountId: data.accountId,
      });

      try {
        await createInitialSummaryJob(group);
      } catch (error) {
        logger.error('创建新建群组初始摘要任务失败', {
          error: error instanceof Error ? error.message : String(error),
          groupId: group.id,
          title: group.title,
        });
      }

      return c.json({ data: group }, 201);
    } catch (error) {
      logger.error('创建群组失败', error instanceof Error ? error : undefined);
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to create group' },
        500,
      );
    }
  },
);

// PATCH /api/groups/:id - 更新群组配置
app.patch('/:id', zValidator('json', updateGroupSchema), async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const updates = c.req.valid('json');

  const [updatedGroup] = await db
    .update(groups)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(groups.id, id))
    .returning();

  if (!updatedGroup) {
    return c.json({ error: 'Group not found' }, 404);
  }

  logger.info('群组配置已更新', { groupId: id, updates });

  return c.json({ data: updatedGroup });
});

// DELETE /api/groups/:id - 删除群组
app.delete('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  await db.delete(groups).where(eq(groups.id, id));

  logger.info('群组已删除', { groupId: id });

  return c.json({ success: true });
});

export default app;
