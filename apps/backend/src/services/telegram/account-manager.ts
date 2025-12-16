import { db, groups, telegramAccounts } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { TelegramClientWrapper } from './telegram-client-wrapper';

/**
 * 账号使用追踪信息
 */
interface AccountUsage {
  lastUsed: Date;
  refCount: number;
  autoDisconnectTimer?: NodeJS.Timeout;
}

class TelegramAccountManager {
  private clients: Map<number, TelegramClientWrapper> = new Map();
  private accountUsage: Map<number, AccountUsage> = new Map();

  // 配置参数
  private readonly connectionTTL = 5 * 60 * 1000; // 5分钟空闲自动断开
  private readonly cleanupInterval = 2 * 60 * 1000; // 每2分钟检查一次空闲连接
  private cleanupTimer?: NodeJS.Timeout;

  /**
   * 初始化账号管理器（懒加载模式，不立即连接）
   */
  async initializeAllAccounts() {
    logger.info('🚀 Telegram 账号管理器启动（懒加载模式）');

    const accounts = await db.query.telegramAccounts.findMany({
      where: eq(telegramAccounts.isActive, true),
    });

    logger.info(`📊 找到 ${accounts.length} 个活跃账号（将按需连接）`);

    // 启动空闲连接清理任务
    this.startIdleConnectionCleanup();

    logger.info('✅ 账号管理器已就绪，连接将在首次使用时自动建立');
  }

  /**
   * 获取账号的 client wrapper（懒加载 + 连接池复用）
   *
   * 策略：
   * 1. 如果已连接，直接复用并刷新TTL
   * 2. 如果未连接，按需建立连接
   * 3. 连接后5分钟无使用自动释放
   */
  async getClient(accountId: number): Promise<TelegramClientWrapper> {
    // 检查是否已有连接
    const existing = this.clients.get(accountId);
    if (existing?.isConnected()) {
      logger.debug(`♻️ 复用现有连接 [账号ID: ${accountId}]`);
      this.updateUsage(accountId);
      return existing;
    }

    // 懒加载：按需建立新连接
    const account = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.id, accountId),
    });

    if (!account) {
      throw new Error(`账号不存在 [ID: ${accountId}]`);
    }

    if (!account.isActive) {
      throw new Error(`账号已停用 [ID: ${accountId}]`);
    }

    logger.info(`🔌 按需连接账号: ${account.phoneNumber} [ID: ${accountId}]`);
    await this.initializeAccount(accountId, account.sessionString);

    // 更新数据库连接状态
    await db
      .update(telegramAccounts)
      .set({
        isConnected: true,
        lastConnectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(telegramAccounts.id, accountId));

    this.updateUsage(accountId);

    const wrapper = this.clients.get(accountId);
    if (!wrapper) {
      throw new Error(`账号连接失败 [ID: ${accountId}]`);
    }
    return wrapper;
  }

  /**
   * 初始化单个账号
   */
  async initializeAccount(accountId: number, sessionString: string) {
    const wrapper = new TelegramClientWrapper(accountId, sessionString);
    await wrapper.initialize();
    await wrapper.connect();
    this.clients.set(accountId, wrapper);
  }

  /**
   * 更新账号使用记录并调度自动断开
   */
  private updateUsage(accountId: number) {
    const usage = this.accountUsage.get(accountId) || {
      lastUsed: new Date(),
      refCount: 0,
    };

    usage.lastUsed = new Date();
    usage.refCount++;

    // 清除旧的自动断开定时器
    if (usage.autoDisconnectTimer) {
      clearTimeout(usage.autoDisconnectTimer);
    }

    // 调度新的自动断开
    usage.autoDisconnectTimer = setTimeout(async () => {
      const idleTime = Date.now() - usage.lastUsed.getTime();
      if (idleTime >= this.connectionTTL) {
        logger.info(
          `🧹 连接空闲超时，自动释放 [账号ID: ${accountId}]，空闲时长: ${Math.round(idleTime / 60000)}分钟`,
        );
        await this.disconnectAccount(accountId);
      }
    }, this.connectionTTL);

    this.accountUsage.set(accountId, usage);
  }

  /**
   * 启动空闲连接清理任务
   */
  private startIdleConnectionCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      const now = Date.now();
      const accountsToCleanup: number[] = [];

      // 1. 检查空闲连接
      for (const [accountId, usage] of this.accountUsage.entries()) {
        const idleTime = now - usage.lastUsed.getTime();
        if (idleTime > this.connectionTTL && this.clients.has(accountId)) {
          accountsToCleanup.push(accountId);
        }
      }

      if (accountsToCleanup.length > 0) {
        logger.info(`🧹 定期清理: 发现 ${accountsToCleanup.length} 个空闲连接`);
        for (const accountId of accountsToCleanup) {
          await this.disconnectAccount(accountId);
        }
      }

      // 2. 检查停用账号
      await this.cleanupInactiveAccounts();
    }, this.cleanupInterval);

    logger.debug(`⏰ 空闲连接清理任务已启动，间隔: ${this.cleanupInterval / 1000}秒`);
  }

  /**
   * 断开单个账号连接
   */
  async disconnectAccount(accountId: number) {
    const wrapper = this.clients.get(accountId);
    if (wrapper) {
      await wrapper.disconnect();
      this.clients.delete(accountId);

      // 更新数据库状态
      await db
        .update(telegramAccounts)
        .set({
          isConnected: false,
          updatedAt: new Date(),
        })
        .where(eq(telegramAccounts.id, accountId));

      logger.info(`🔌 账号连接已释放 [ID: ${accountId}]`);
    }

    // 清理使用记录
    const usage = this.accountUsage.get(accountId);
    if (usage?.autoDisconnectTimer) {
      clearTimeout(usage.autoDisconnectTimer);
    }
    this.accountUsage.delete(accountId);
  }

  /**
   * 检查并清理停用账号的连接
   */
  async cleanupInactiveAccounts() {
    const inactiveAccounts = await db.query.telegramAccounts.findMany({
      where: eq(telegramAccounts.isActive, false),
    });

    for (const account of inactiveAccounts) {
      if (this.clients.has(account.id)) {
        logger.info(`🔌 账号已停用，释放连接 [ID: ${account.id}]`);
        await this.disconnectAccount(account.id);
      }
    }
  }

  /**
   * 只连接有活跃群组的账号（优化启动策略）
   */
  async connectAccountsWithActiveGroups() {
    const activeGroups = await db.query.groups.findMany({
      where: eq(groups.isActive, true),
    });

    const accountIds = new Set(activeGroups.map((g) => g.accountId));

    logger.info(`📊 发现 ${accountIds.size} 个账号有活跃群组订阅`);

    for (const accountId of accountIds) {
      try {
        await this.getClient(accountId); // 使用懒加载逻辑
      } catch (error) {
        logger.error(`连接账号失败 [ID: ${accountId}]`, error instanceof Error ? error : undefined);
      }
    }

    logger.info('✅ 已预连接有群组订阅的账号');
  }

  /**
   * 添加新账号（认证流程）
   */
  async addAccount(phoneNumber: string, authCallback: (client: TelegramClient) => Promise<void>) {
    logger.info(`📱 开始添加新账号: ${phoneNumber}`);

    // 检查是否已存在
    const existing = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.phoneNumber, phoneNumber),
    });

    if (existing) {
      throw new Error(`账号 ${phoneNumber} 已存在`);
    }

    // 创建临时 client 用于认证
    const session = new StringSession('');
    const client = new TelegramClient(
      session,
      Number.parseInt(env.TELEGRAM_API_ID),
      env.TELEGRAM_API_HASH,
      { connectionRetries: 5 },
    );

    try {
      // 执行认证
      await authCallback(client);

      // 获取用户信息
      const me = await client.getMe();

      logger.info(`✅ 认证成功，获取到用户信息: ${me.firstName} ${me.lastName || ''}`);

      // 保存到数据库
      const [account] = await db
        .insert(telegramAccounts)
        .values({
          phoneNumber,
          userId: me.id?.toString(),
          username: me.username,
          firstName: me.firstName,
          lastName: me.lastName,
          sessionString: session.save(),
          isActive: true,
          isConnected: true,
          lastConnectedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!account) {
        throw new Error('Failed to create account');
      }

      logger.info(`💾 账号已保存到数据库 [ID: ${account.id}]`);

      // 初始化 client wrapper
      await this.initializeAccount(account.id, session.save());

      logger.info(`🎉 新账号添加成功: ${phoneNumber} [ID: ${account.id}]`);
      return account;
    } catch (error) {
      // 认证失败，断开连接
      if (client.connected) {
        await client.disconnect();
      }
      throw error;
    }
  }

  /**
   * 移除账号
   */
  async removeAccount(accountId: number) {
    logger.info(`🗑️ 正在移除账号 [ID: ${accountId}]`);

    const wrapper = this.clients.get(accountId);
    if (wrapper) {
      await wrapper.disconnect();
      this.clients.delete(accountId);
    }

    await db.delete(telegramAccounts).where(eq(telegramAccounts.id, accountId));

    logger.info(`✅ 账号已移除 [ID: ${accountId}]`);
  }

  /**
   * 获取所有已连接的账号ID
   */
  getAllAccountIds(): number[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 检查账号是否已连接
   */
  isAccountConnected(accountId: number): boolean {
    const wrapper = this.clients.get(accountId);
    return wrapper?.isConnected() ?? false;
  }

  /**
   * 优雅关闭所有连接
   */
  async shutdown() {
    logger.info('🔌 正在关闭所有 Telegram 连接...');

    // 清理所有定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    for (const usage of this.accountUsage.values()) {
      if (usage.autoDisconnectTimer) {
        clearTimeout(usage.autoDisconnectTimer);
      }
    }

    for (const [accountId, wrapper] of this.clients.entries()) {
      try {
        await wrapper.disconnect();

        // 更新数据库状态
        await db
          .update(telegramAccounts)
          .set({
            isConnected: false,
            updatedAt: new Date(),
          })
          .where(eq(telegramAccounts.id, accountId));
      } catch (error) {
        logger.error(
          `关闭账号连接失败 [ID: ${accountId}]`,
          error instanceof Error ? error : undefined,
        );
      }
    }

    this.clients.clear();
    this.accountUsage.clear();
    logger.info('✅ 所有连接已关闭');
  }
}

export const telegramAccountManager = new TelegramAccountManager();
