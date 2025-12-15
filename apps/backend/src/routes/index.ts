import { Hono } from 'hono';
import { cors } from 'hono/cors';
import groupsRoute from './groups';
import summariesRoute from './summaries';
import telegramRoute from './telegram';
import filterRulesRoute from './filter-rules';
import systemConfigRoute from './system-config';

const app = new Hono();

// CORS 配置
app.use('/*', cors());

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 注册路由
app.route('/api/groups', groupsRoute);
app.route('/api/summaries', summariesRoute);
app.route('/api/telegram', telegramRoute);
app.route('/api/filter-rules', filterRulesRoute);
app.route('/api/system-config', systemConfigRoute);

// 404 处理
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
export type AppType = typeof app;
