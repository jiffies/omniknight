import { serve } from '@hono/node-server';
import app from './routes/index';
import { env } from './config/env';
import { logger } from './utils/logger';
import { telegramService } from './services/telegram/client';
import { schedulerService } from './services/scheduler/scheduler';

async function main() {
  try {
    logger.info('========================================');
    logger.info('🚀 开始启动 Omniknight 服务');
    logger.info('========================================');

    // 1. 初始化 Telegram 客户端
    logger.info('[步骤 1/5] 正在初始化 Telegram 客户端...');
    await telegramService.initialize();
    logger.info('[步骤 1/5] ✅ Telegram 客户端初始化完成');

    // 2. 检查是否已认证
    logger.info('[步骤 2/5] 正在连接 Telegram...');
    try {
      await telegramService.connect();
      logger.info('[步骤 2/5] ✅ Telegram 客户端已连接');

      // 3. 开始监听消息
      logger.info('[步骤 3/5] 检查消息监听配置...');
      await telegramService.startListening();
      logger.info('[步骤 3/5] ✅ 消息监听配置完成(使用按需拉取模式)');
    } catch (error) {
      logger.warn('[步骤 2/5] ⚠️ Telegram 未认证，需要先进行认证');
      logger.info('💡 请运行 "pnpm setup" 完成认证');
      // 如果未认证，仍然启动 API 服务器，以便通过 API 完成认证
    }

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
process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，正在关闭服务...');
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务...');
  schedulerService.stop();
  process.exit(0);
});

main();
