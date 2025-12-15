/**
 * 初始化脚本
 * 用于首次设置时：
 * 1. Telegram 认证
 * 2. 选择要监听的群组
 * 3. 保存到数据库
 */

import { telegramService } from '../services/telegram/client';
import { db, groups } from '@omniknight/db';
import { logger } from '../utils/logger';
import input from 'input';

async function setup() {
  try {
    logger.info('=== Omniknight 初始化设置 ===\n');

    // 1. 初始化 Telegram 客户端
    logger.info('步骤 1/3: 初始化 Telegram 客户端');
    await telegramService.initialize();

    // 2. 认证
    logger.info('步骤 2/3: Telegram 认证');
    await telegramService.authenticate();

    // 3. 获取并选择群组
    logger.info('步骤 3/3: 选择要监听的群组');
    const dialogs = await telegramService.getDialogs();

    if (dialogs.length === 0) {
      logger.warn('未找到任何群组或频道');
      return;
    }

    logger.info(`\n找到 ${dialogs.length} 个群组/频道：\n`);
    dialogs.forEach((dialog, index) => {
      console.log(`${index + 1}. ${dialog.title} (${dialog.type})`);
    });

    const selection = await input.text('\n请输入要监听的群组编号（多个用逗号分隔，如 1,2,3）：');

    const selectedIndexes = selection
      .split(',')
      .map((s) => parseInt(s.trim()) - 1)
      .filter((i) => i >= 0 && i < dialogs.length);

    if (selectedIndexes.length === 0) {
      logger.warn('未选择任何群组');
      return;
    }

    // 保存到数据库
    for (const index of selectedIndexes) {
      const dialog = dialogs[index];
      if (!dialog) continue;

      await db
        .insert(groups)
        .values({
          telegramId: dialog.id!,
          title: dialog.title,
          username: dialog.username,
          type: dialog.type as 'group' | 'channel' | 'supergroup',
          isActive: true,
          summaryEnabled: true,
          summaryInterval: 6,
          minMessagesForSummary: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      logger.info(`✓ 已添加: ${dialog.title}`);
    }

    logger.info(`\n✅ 设置完成！已添加 ${selectedIndexes.length} 个群组`);
    logger.info('现在可以运行 "pnpm dev" 启动服务了\n');
  } catch (error) {
    logger.error('设置失败', error instanceof Error ? error : undefined);
    process.exit(1);
  }

  process.exit(0);
}

setup();
