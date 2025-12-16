import { zValidator } from '@hono/zod-validator';
import { db, systemConfig } from '@omniknight/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { logger } from '../utils/logger';

const app = new Hono();

// 可编辑的配置键白名单（安全控制）
const EDITABLE_KEYS: string[] = [
  'ai_provider', // mock/openai/deepseek/gemini
  'ai_model', // 模型名称
  'ai_temperature', // 温度参数
  'rate_limit_batch_size_steps', // [1000, 500, 300, 100]
  'rate_limit_wait_ms_steps', // [2000, 3000, 4000, 5000]
];

// 辅助函数：解析JSON值
function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// GET /api/system-config - 获取所有可编辑配置
app.get('/', async (c) => {
  try {
    const configs = await db.select().from(systemConfig);

    const editableConfigs = configs.filter((cfg) => EDITABLE_KEYS.includes(cfg.key));

    // 解析 JSON 值
    const parsed = editableConfigs.map((cfg) => ({
      key: cfg.key,
      value: tryParseJSON(cfg.value),
      updatedAt: cfg.updatedAt,
    }));

    return c.json({ data: parsed });
  } catch (error) {
    logger.error('获取系统配置失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch system config' }, 500);
  }
});

// PUT /api/system-config/:key - 更新单个配置
const updateSchema = z.object({
  value: z.unknown(),
});

app.put('/:key', zValidator('json', updateSchema), async (c) => {
  try {
    const key = c.req.param('key');
    const { value } = c.req.valid('json');

    if (!EDITABLE_KEYS.includes(key)) {
      return c.json({ error: 'Config key not editable' }, 403);
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    await db
      .insert(systemConfig)
      .values({
        key,
        value: stringValue,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: stringValue,
          updatedAt: new Date(),
        },
      });

    logger.info('系统配置已更新', { key, value: stringValue });

    return c.json({ success: true });
  } catch (error) {
    logger.error('更新系统配置失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to update system config' }, 500);
  }
});

export default app;
