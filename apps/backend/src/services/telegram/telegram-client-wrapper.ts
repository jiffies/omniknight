import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class TelegramClientWrapper {
  private client: TelegramClient | null = null;
  private session: StringSession;

  constructor(
    public readonly accountId: number,
    sessionString: string,
  ) {
    this.session = new StringSession(sessionString);
  }

  async initialize() {
    logger.info(`📡 正在创建 TelegramClient 实例 [账号ID: ${this.accountId}]`);

    this.client = new TelegramClient(
      this.session,
      Number.parseInt(env.TELEGRAM_API_ID),
      env.TELEGRAM_API_HASH,
      {
        connectionRetries: 5,
        timeout: 60,
        requestRetries: 3,
      },
    );

    logger.info(`✅ Telegram 客户端初始化完成 [账号ID: ${this.accountId}]`);
  }

  async connect() {
    if (!this.client) {
      throw new Error(`Client not initialized for account ${this.accountId}`);
    }

    logger.info(`🔌 正在连接到 Telegram 服务器 [账号ID: ${this.accountId}]...`);
    if (!this.client.connected) {
      // 禁用 _updateLoop：我们使用"按需拉取模式"，不需要实时更新
      // @ts-expect-error 访问私有属性
      this.client._loopStarted = true;

      await this.client.connect();
      logger.info(`✅ Telegram 客户端已成功连接 [账号ID: ${this.accountId}]`);
    } else {
      logger.info(`ℹ️ Telegram 客户端已经处于连接状态 [账号ID: ${this.accountId}]`);
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        if (this.client.connected) {
          await this.client.disconnect();
        }
      } finally {
        await this.client.destroy();
        logger.info(`🔌 Telegram 已断开并销毁 [账号ID: ${this.accountId}]`);
      }
    }
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  getClient(): TelegramClient {
    if (!this.client) {
      throw new Error(`Telegram client not initialized for account ${this.accountId}`);
    }
    if (!this.client.connected) {
      throw new Error(`Telegram client not connected for account ${this.accountId}`);
    }
    return this.client;
  }

  getSession(): StringSession {
    return this.session;
  }

  async getDialogs() {
    if (!this.client) {
      throw new Error(`Client not initialized for account ${this.accountId}`);
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
          username: entity && 'username' in entity ? entity.username : undefined,
          type,
          isForum,
        };
      });
  }

  async getForumTopics(channelId: string) {
    if (!this.client) {
      throw new Error(`Client not initialized for account ${this.accountId}`);
    }

    try {
      const entity = await this.client.getEntity(channelId);

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

      return result.topics.map((topic) => {
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
      logger.error(
        `获取Forum Topics失败 [账号ID: ${this.accountId}]`,
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }
}
