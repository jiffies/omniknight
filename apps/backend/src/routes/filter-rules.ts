import { zValidator } from '@hono/zod-validator';
import { db, filterRules } from '@omniknight/db';
import { createFilterRuleSchema, updateFilterRuleSchema } from '@omniknight/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { logger } from '../utils/logger';

const app = new Hono();

// GET /api/filter-rules - 获取所有规则
app.get('/', async (c) => {
  try {
    const rules = await db.query.filterRules.findMany({
      orderBy: (filterRules, { asc }) => [asc(filterRules.priority)],
    });

    // 解析 JSON config
    const rulesWithParsedConfig = rules.map((rule) => ({
      ...rule,
      config: JSON.parse(rule.config),
    }));

    return c.json({ data: rulesWithParsedConfig });
  } catch (error) {
    logger.error('获取过滤规则失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch filter rules' }, 500);
  }
});

// POST /api/filter-rules - 创建规则
app.post('/', zValidator('json', createFilterRuleSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    const [rule] = await db
      .insert(filterRules)
      .values({
        name: data.name,
        type: data.type,
        config: JSON.stringify(data.config),
        priority: data.priority,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!rule) {
      throw new Error('Failed to create rule');
    }

    logger.info('过滤规则已创建', { ruleId: rule.id, name: rule.name });

    return c.json({ data: rule }, 201);
  } catch (error) {
    logger.error('创建过滤规则失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to create filter rule' }, 500);
  }
});

// PATCH /api/filter-rules/:id - 更新规则
app.patch('/:id', zValidator('json', updateFilterRuleSchema), async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    const updates = c.req.valid('json');

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.config) {
      updateData.config = JSON.stringify(updates.config);
    }
    if (updates.isEnabled !== undefined) {
      updateData.isEnabled = updates.isEnabled;
    }
    if (updates.priority !== undefined) {
      updateData.priority = updates.priority;
    }

    const [updated] = await db
      .update(filterRules)
      .set(updateData)
      .where(eq(filterRules.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: 'Rule not found' }, 404);
    }

    logger.info('过滤规则已更新', { ruleId: id });

    return c.json({ data: updated });
  } catch (error) {
    logger.error('更新过滤规则失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to update filter rule' }, 500);
  }
});

// DELETE /api/filter-rules/:id - 删除规则
app.delete('/:id', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));

    await db.delete(filterRules).where(eq(filterRules.id, id));

    logger.info('过滤规则已删除', { ruleId: id });

    return c.json({ success: true });
  } catch (error) {
    logger.error('删除过滤规则失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to delete filter rule' }, 500);
  }
});

export default app;
