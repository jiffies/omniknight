import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// 全局定时器函数声明（避免TypeScript类型错误）
declare const setInterval: (
  handler: (...args: unknown[]) => void,
  timeout: number,
  ...args: unknown[]
) => number;
declare const clearInterval: (handle: number) => void;
declare const setTimeout: (
  handler: (...args: unknown[]) => void,
  timeout: number,
  ...args: unknown[]
) => number;
declare const clearTimeout: (handle: number) => void;

export class TelegramClientWrapper {
  private client: TelegramClient | null = null;
  private session: StringSession;
  private keepAliveTimer?: number;
  private reconnectTimer?: number;
  private isReconnecting = false;

  // 配置参数
  private readonly KEEP_ALIVE_INTERVAL = 60 * 1000; // 每60秒发送一次心跳
  private readonly RECONNECT_DELAY = 5 * 1000; // 重连延迟5秒
  private readonly MAX_RECONNECT_ATTEMPTS = 3; // 最大重连次数
  private reconnectAttempts = 0;

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
        timeout: 30, // 设置30秒超时
        requestRetries: 3, // 请求重试3次
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
      await this.client.connect();
      logger.info(`✅ Telegram 客户端已成功连接 [账号ID: ${this.accountId}]`);

      // 连接成功后启动心跳保活
      this.startKeepAlive();
      this.reconnectAttempts = 0; // 重置重连计数
    } else {
      logger.info(`ℹ️ Telegram 客户端已经处于连接状态 [账号ID: ${this.accountId}]`);
    }
  }

  async disconnect() {
    // 停止心跳和重连定时器
    this.stopKeepAlive();
    this.stopReconnect();

    if (this.client?.connected) {
      await this.client.disconnect();
      logger.info(`🔌 Telegram 已断开连接 [账号ID: ${this.accountId}]`);
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

  /**
   * 启动心跳保活机制
   */
  private startKeepAlive() {
    // 清理旧的定时器
    this.stopKeepAlive();

    logger.debug(
      `💓 启动心跳保活 [账号ID: ${this.accountId}]，间隔: ${this.KEEP_ALIVE_INTERVAL / 1000}秒`,
    );

    this.keepAliveTimer = setInterval(async () => {
      try {
        if (!this.client?.connected) {
          logger.warn(`⚠️ 心跳检测到连接已断开 [账号ID: ${this.accountId}]，准备重连`);
          this.stopKeepAlive();
          await this.attemptReconnect();
          return;
        }

        // 发送轻量级的 ping 请求保持连接活跃
        await this.client.invoke({ _: 'ping', pingId: BigInt(Date.now()) } as any);
        logger.debug(`💓 心跳发送成功 [账号ID: ${this.accountId}]`);
      } catch (error) {
        logger.warn(
          `⚠️ 心跳失败 [账号ID: ${this.accountId}]`,
          error instanceof Error ? { message: error.message, stack: error.stack } : undefined,
        );

        // 心跳失败，尝试重连
        this.stopKeepAlive();
        await this.attemptReconnect();
      }
    }, this.KEEP_ALIVE_INTERVAL);
  }

  /**
   * 停止心跳保活
   */
  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
      logger.debug(`💔 停止心跳保活 [账号ID: ${this.accountId}]`);
    }
  }

  /**
   * 停止重连定时器
   */
  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * 尝试重连
   */
  private async attemptReconnect() {
    if (this.isReconnecting) {
      logger.debug(`🔄 已有重连任务在进行 [账号ID: ${this.accountId}]`);
      return;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`❌ 重连失败次数过多 [账号ID: ${this.accountId}]，停止重连`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    logger.info(
      `🔄 尝试重连 (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) [账号ID: ${this.accountId}]`,
    );

    try {
      // 先断开旧连接
      if (this.client?.connected) {
        await this.client.disconnect();
      }

      // 延迟后重连
      await new Promise((resolve) => setTimeout(resolve, this.RECONNECT_DELAY));

      // 重新连接
      if (this.client) {
        await this.client.connect();
        logger.info(`✅ 重连成功 [账号ID: ${this.accountId}]`);

        // 重启心跳
        this.startKeepAlive();
        this.reconnectAttempts = 0; // 重置计数
      }
    } catch (error) {
      logger.error(
        `❌ 重连失败 [账号ID: ${this.accountId}]`,
        error instanceof Error ? { message: error.message, stack: error.stack } : undefined,
      );

      // 如果还有重试机会，调度下一次重连
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectTimer = setTimeout(() => {
          this.isReconnecting = false;
          this.attemptReconnect();
        }, this.RECONNECT_DELAY * this.reconnectAttempts);
      }
    } finally {
      this.isReconnecting = false;
    }
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
