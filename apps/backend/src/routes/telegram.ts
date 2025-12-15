import { Hono } from 'hono';
import { telegramService } from '../services/telegram/client';
import { logger } from '../utils/logger';

const app = new Hono();

// GET /api/telegram/status - 获取连接状态
app.get('/status', (c) => {
  return c.json({
    authenticated: telegramService.isAuthenticated(),
  });
});

// GET /api/telegram/dialogs - 获取群组/频道列表
app.get('/dialogs', async (c) => {
  try {
    const dialogs = await telegramService.getDialogs();
    return c.json({ data: dialogs });
  } catch (error) {
    logger.error('获取对话列表失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch dialogs' }, 500);
  }
});

// GET /api/telegram/forums/:channelId/topics - 获取Forum的所有topics
app.get('/forums/:channelId/topics', async (c) => {
  const channelId = c.req.param('channelId');

  try {
    const topics = await telegramService.getForumTopics(channelId);
    return c.json({ data: topics });
  } catch (error) {
    logger.error('获取Forum Topics失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch forum topics' }, 500);
  }
});

export default app;
