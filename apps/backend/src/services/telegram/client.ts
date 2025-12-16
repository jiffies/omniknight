import { db, systemConfig } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

class TelegramService {
  private client: TelegramClient | null = null;
  private session: StringSession | null = null;

  async initialize() {
    logger.info('📡 开始初始化 Telegram 客户端');

    logger.info('📂 正在从数据库加载 session...');
    const sessionData = await this.loadSession();
    logger.info(`📂 Session ${sessionData ? '已加载' : '为空(首次使用)'}`);

    this.session = new StringSession(sessionData);

    logger.info('🔧 正在创建 TelegramClient 实例...');
    this.client = new TelegramClient(
      this.session,
      Number.parseInt(env.TELEGRAM_API_ID),
      env.TELEGRAM_API_HASH,
      {
        connectionRetries: 5,
        timeout: 60,
      },
    );

    logger.info('✅ Telegram 客户端初始化完成');
  }

  async connect() {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    logger.info('🔌 正在连接到 Telegram 服务器...');
    if (!this.client.connected) {
      await this.client.connect();
      logger.info('✅ Telegram 客户端已成功连接');
    } else {
      logger.info('ℹ️ Telegram 客户端已经处于连接状态');
    }
  }

  async startListening() {
    // 已废弃：改为按需拉取模式，不再实时监听消息
    logger.info('消息监听已禁用（使用按需拉取模式）');
  }

  async getDialogs() {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const dialogs = await this.client.getDialogs({ limit: 100 });

    return dialogs
      .filter((dialog) => dialog.isGroup || dialog.isChannel)
      .map((dialog) => {
        const entity = dialog.entity;
        let type: 'group' | 'channel' | 'supergroup' | 'forum' = 'group';
        let isForum = false;

        if (entity && 'className' in entity && entity.className === 'Channel') {
          if (entity.broadcast) {
            type = 'channel';
          } else if (entity.forum) {
            type = 'forum';
            isForum = true;
          } else if (entity.megagroup) {
            type = 'supergroup';
          }
        }

        return {
          id: dialog.id?.toString(),
          title: dialog.title || '未知',
          username: entity && 'username' in entity ? (entity.username as string | undefined) : undefined,
          type,
          isForum,
        };
      });
  }

  async getForumTopics(channelId: string) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const entity = await this.client.getEntity(channelId);

      // 调用Telegram API获取Forum Topics
      const { Api } = await import('telegram');
      const result = await this.client.invoke(
        new Api.channels.GetForumTopics({
          channel: entity,
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit: 100,
        }),
      );

      // 解析topics
      return result.topics.map((topic) => {
        // topic是ForumTopic类型，包含id, title等属性
        const topicData = topic as {
          id: number;
          title?: string;
          iconColor?: number;
          iconEmojiId?: string;
        };
        return {
          id: topicData.id,
          title: topicData.title || '未命名话题',
          iconColor: topicData.iconColor,
          iconEmojiId: topicData.iconEmojiId,
        };
      });
    } catch (error) {
      logger.error('获取Forum Topics失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return this.client?.connected ?? false;
  }

  /**
   * 获取 Telegram 客户端实例
   * 用于消息拉取等高级操作
   */
  getClient(): TelegramClient {
    if (!this.client) {
      throw new Error('Telegram client not initialized');
    }
    if (!this.client.connected) {
      throw new Error('Telegram client not connected');
    }
    return this.client;
  }

  private async loadSession(): Promise<string> {
    const result = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'telegram_session'),
    });

    return result?.value || '';
  }

  private async saveSession(sessionString: string) {
    await db
      .insert(systemConfig)
      .values({
        key: 'telegram_session',
        value: sessionString,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: sessionString,
          updatedAt: new Date(),
        },
      });
  }
}

export const telegramService = new TelegramService();
