import { serve } from '@hono/node-server';
import { env } from './config/env';
import app from './routes/index';
import { schedulerService } from './services/scheduler/scheduler';
import { telegramAccountManager } from './services/telegram/account-manager';
import { logger } from './utils/logger';


async function main() {
  try {
    logger.info('========================================');
    logger.info('🚀 开始启动 Omniknight 服务');
    logger.info('========================================');

    // 1. 初始化 Telegram 账号管理器（懒加载模式）
    logger.info('[步骤 1/5] 正在初始化 Telegram 账号管理器...');
    try {
      await telegramAccountManager.initializeAllAccounts();
      logger.info('[步骤 1/5] ✅ Telegram 账号管理器已就绪（懒加载模式）');

      // 可选：预连接有活跃群组的账号（提升首次响应速度）
      // 如果不需要预连接，可以注释掉下面这行
      // await telegramAccountManager.connectAccountsWithActiveGroups();
    } catch (error) {
      logger.warn('[步骤 1/5] ⚠️ Telegram 账号管理器初始化失败');
      logger.info('💡 请通过前端或 API 添加 Telegram 账号');
      // 即使初始化失败，仍然启动服务器
    }

    // 2-3. 跳过（改用多账号管理）
    logger.info('[步骤 2/5] ✅ 使用多账号管理模式');
    logger.info('[步骤 3/5] ✅ 消息监听配置完成(使用按需拉取模式)');

    // 4. 启动定时调度器
    logger.info('[步骤 4/5] 正在启动定时调度器...');
    await schedulerService.start();
    logger.info('[步骤 4/5] ✅ 定时调度器已启动');

    // 5. 启动 API 服务器
    logger.info('[步骤 5/5] 正在启动 API 服务器...');
    const port = Number.parseInt(env.PORT);
    serve({
      fetch: app.fetch,
      port,
    });

    logger.info('[步骤 5/5] ✅ API 服务器已启动');
    logger.info('========================================');
    logger.info('🎉 服务启动成功!');
    logger.info(`📍 后端 API: http://localhost:${port}`);
    logger.info(`📊 健康检查: http://localhost:${port}/health`);
    logger.info(`📚 API 文档: http://localhost:${port}/api`);
    logger.info('========================================');
  } catch (error) {
    logger.error('========================================');
    logger.error('❌ 服务启动失败', error instanceof Error ? error : undefined);
    logger.error('========================================');
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务...');
  await telegramAccountManager.shutdown();
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务...');
  await telegramAccountManager.shutdown();
  schedulerService.stop();
  process.exit(0);
});

main();
