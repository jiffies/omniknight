import { Hono } from 'hono';
import { cors } from 'hono/cors';
import accountsRoute from './accounts';
import filterRulesRoute from './filter-rules';
import groupsRoute from './groups';
import pushRoute from './push';
import summariesRoute from './summaries';
import systemConfigRoute from './system-config';
import telegramRoute from './telegram';

// 创建 API router（不带前缀）
const apiRoutes = new Hono()
  .route('/accounts', accountsRoute)
  .route('/groups', groupsRoute)
  .route('/summaries', summariesRoute)
  .route('/telegram', telegramRoute)
  .route('/filter-rules', filterRulesRoute)
  .route('/system-config', systemConfigRoute)
  .route('/push', pushRoute);

// 主应用
const app = new Hono()
  // CORS 配置
  .use('/*', cors())

  // 健康检查
  .get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  })

  // 挂载 API 路由
  .route('/api', apiRoutes)

  // 404 处理
  .notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  })

  // 错误处理
  .onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

export default app;
export type AppType = typeof app;
// 导出 API routes 类型供 RPC 使用
export type ApiRoutesType = typeof apiRoutes;
