import { db, groups, telegramAccounts } from '@omniknight/db';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { TelegramClient } from 'telegram';
import { TelegramClient as TelegramClientClass } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../config/env';
import { telegramAccountManager } from '../services/telegram/account-manager';
import { logger } from '../utils/logger';

const app = new Hono();

// 存储临时认证会话
interface AuthSession {
  phoneNumber: string;
  client: TelegramClient;
  phoneCodeHash?: string;
  needPassword?: boolean;
}

const authSessions = new Map<string, AuthSession>();

// GET /api/accounts - 获取所有账号列表
app.get('/', async (c) => {
  try {
    const accounts = await db.query.telegramAccounts.findMany({
      orderBy: (telegramAccounts, { desc }) => [desc(telegramAccounts.createdAt)],
    });

    // 添加统计信息
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        const [groupCountResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(groups)
          .where(eq(groups.accountId, account.id));

        const { sessionString: _sessionString, ...accountWithoutSession } = account;
        return {
          ...accountWithoutSession,
          groupCount: groupCountResult?.count || 0,
        };
      }),
    );

    return c.json({ data: accountsWithStats });
  } catch (error) {
    logger.error('获取账号列表失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch accounts' }, 500);
  }
});

// POST /api/accounts/auth/send-code - 步骤1：发送验证码
app.post('/auth/send-code', async (c) => {
  try {
    const { phoneNumber } = await c.req.json();

    if (!phoneNumber) {
      return c.json({ error: 'Phone number is required' }, 400);
    }

    logger.info(`发送验证码请求: ${phoneNumber}`);

    // 检查是否已存在
    const existing = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.phoneNumber, phoneNumber),
    });

    if (existing) {
      return c.json({ error: 'Account already exists' }, 409);
    }

    // 创建新的 Telegram client
    const session = new StringSession('');
    const client = new TelegramClientClass(
      session,
      Number.parseInt(env.TELEGRAM_API_ID),
      env.TELEGRAM_API_HASH,
      { connectionRetries: 5 },
    );

    await client.connect();

    // 发送验证码
    const result = await client.sendCode(
      {
        apiId: Number.parseInt(env.TELEGRAM_API_ID),
        apiHash: env.TELEGRAM_API_HASH,
      },
      phoneNumber,
    );

    // 保存会话
    const sessionId = `${phoneNumber}_${Date.now()}`;
    authSessions.set(sessionId, {
      phoneNumber,
      client,
      phoneCodeHash: result.phoneCodeHash,
    });

    logger.info(`验证码已发送: ${phoneNumber} [Session: ${sessionId}]`);

    // 5分钟后清理会话
    setTimeout(
      () => {
        const session = authSessions.get(sessionId);
        if (session) {
          session.client.disconnect().catch(() => {});
          authSessions.delete(sessionId);
          logger.info(`认证会话已过期: ${sessionId}`);
        }
      },
      5 * 60 * 1000,
    );

    return c.json({
      data: {
        sessionId,
        phoneNumber,
      },
    });
  } catch (error) {
    logger.error('发送验证码失败', error instanceof Error ? error : undefined);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send code' }, 500);
  }
});

// POST /api/accounts/auth/verify-code - 步骤2：验证验证码
app.post('/auth/verify-code', async (c) => {
  try {
    const { sessionId, code } = await c.req.json();

    if (!sessionId || !code) {
      return c.json({ error: 'Session ID and code are required' }, 400);
    }

    const authSession = authSessions.get(sessionId);
    if (!authSession) {
      return c.json({ error: 'Invalid or expired session' }, 404);
    }

    logger.info(`验证验证码: ${authSession.phoneNumber}`);

    try {
      if (!authSession.phoneCodeHash) {
        return c.json({ error: 'Invalid session state' }, 400);
      }

      // 尝试用验证码登录
      await authSession.client.invoke(
        new (await import('telegram/tl')).Api.auth.SignIn({
          phoneNumber: authSession.phoneNumber,
          phoneCodeHash: authSession.phoneCodeHash,
          phoneCode: code,
        }),
      );

      // 登录成功，保存账号
      const me = await authSession.client.getMe();
      const sessionString = (authSession.client.session as StringSession).save();

      const [account] = await db
        .insert(telegramAccounts)
        .values({
          phoneNumber: authSession.phoneNumber,
          userId: me.id?.toString(),
          username: me.username,
          firstName: me.firstName,
          lastName: me.lastName,
          sessionString,
          isActive: true,
          isConnected: true,
          lastConnectedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!account) {
        return c.json({ error: 'Failed to create account' }, 500);
      }

      logger.info(`账号认证成功: ${authSession.phoneNumber} [ID: ${account.id}]`);

      // 初始化账号连接
      await telegramAccountManager.initializeAccount(account.id, sessionString);

      // 清理会话
      authSession.client.disconnect().catch(() => {});
      authSessions.delete(sessionId);

      return c.json({
        data: {
          ...account,
          sessionString: undefined,
        },
      });
    } catch (error: unknown) {
      // 检查是否需要两步验证密码
      const telegramError = error as { errorMessage?: string };
      if (telegramError.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        authSession.needPassword = true;
        logger.info(`需要两步验证密码: ${authSession.phoneNumber}`);
        return c.json({
          data: {
            needPassword: true,
            sessionId,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error('验证码验证失败', error instanceof Error ? error : undefined);
    return c.json(
      { error: error instanceof Error ? error.message : 'Code verification failed' },
      500,
    );
  }
});

// POST /api/accounts/auth/verify-password - 步骤3：验证两步验证密码
app.post('/auth/verify-password', async (c) => {
  try {
    const { sessionId, password } = await c.req.json();

    if (!sessionId || !password) {
      return c.json({ error: 'Session ID and password are required' }, 400);
    }

    const authSession = authSessions.get(sessionId);
    if (!authSession) {
      return c.json({ error: 'Invalid or expired session' }, 404);
    }

    logger.info(`验证两步验证密码: ${authSession.phoneNumber}`);

    // 获取密码信息
    const passwordInfo = await authSession.client.invoke(
      new (await import('telegram/tl')).Api.account.GetPassword(),
    );

    // 使用密码登录
    await authSession.client.invoke(
      new (await import('telegram/tl')).Api.auth.CheckPassword({
        password: await (await import('telegram/Password')).computeCheck(passwordInfo, password),
      }),
    );

    // 登录成功，保存账号
    const me = await authSession.client.getMe();
    const sessionString = (authSession.client.session as StringSession).save();

    const [account] = await db
      .insert(telegramAccounts)
      .values({
        phoneNumber: authSession.phoneNumber,
        userId: me.id?.toString(),
        username: me.username,
        firstName: me.firstName,
        lastName: me.lastName,
        sessionString,
        isActive: true,
        isConnected: true,
        lastConnectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!account) {
      return c.json({ error: 'Failed to create account' }, 500);
    }

    logger.info(`账号认证成功（含2FA）: ${authSession.phoneNumber} [ID: ${account.id}]`);

    // 初始化账号连接
    await telegramAccountManager.initializeAccount(account.id, sessionString);

    // 清理会话
    authSession.client.disconnect().catch(() => {});
    authSessions.delete(sessionId);

    return c.json({
      data: {
        ...account,
        sessionString: undefined,
      },
    });
  } catch (error) {
    logger.error('密码验证失败', error instanceof Error ? error : undefined);
    return c.json(
      { error: error instanceof Error ? error.message : 'Password verification failed' },
      500,
    );
  }
});

// PATCH /api/accounts/:id - 更新账号状态
app.patch('/:id', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    const { isActive } = await c.req.json();

    if (typeof isActive !== 'boolean') {
      return c.json({ error: 'isActive must be a boolean' }, 400);
    }

    const [updated] = await db
      .update(telegramAccounts)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(telegramAccounts.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: 'Account not found' }, 404);
    }

    logger.info(`账号状态已更新 [ID: ${id}]: isActive=${isActive}`);

    return c.json({
      data: {
        ...updated,
        sessionString: undefined,
      },
    });
  } catch (error) {
    logger.error('更新账号失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to update account' }, 500);
  }
});

// DELETE /api/accounts/:id - 删除账号
app.delete('/:id', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));

    // 检查账号是否存在
    const account = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.id, id),
    });

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // 断开连接并从内存中移除
    await telegramAccountManager.removeAccount(id);

    logger.info(`账号已删除: ${account.phoneNumber} [ID: ${id}]`);

    return c.json({ success: true });
  } catch (error) {
    logger.error('删除账号失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to delete account' }, 500);
  }
});

// GET /api/accounts/:id/dialogs - 获取账号的群组列表
app.get('/:id/dialogs', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));

    // 检查账号是否存在
    const account = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.id, id),
    });

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // 获取 client wrapper
    const wrapper = await telegramAccountManager.getClient(id);
    const dialogs = await wrapper.getDialogs();

    logger.info(`获取账号群组列表成功 [ID: ${id}]: ${dialogs.length} 个群组`);

    return c.json({ data: dialogs });
  } catch (error) {
    logger.error('获取对话列表失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch dialogs' }, 500);
  }
});

// GET /api/accounts/:accountId/dialogs/:channelId/topics - 获取Forum Topics
app.get('/:accountId/dialogs/:channelId/topics', async (c) => {
  try {
    const accountId = Number.parseInt(c.req.param('accountId'));
    const channelId = c.req.param('channelId');

    const wrapper = await telegramAccountManager.getClient(accountId);
    const topics = await wrapper.getForumTopics(channelId);

    logger.info(
      `获取Forum Topics成功 [账号ID: ${accountId}] [频道ID: ${channelId}]: ${topics.length} 个话题`,
    );

    return c.json({ data: topics });
  } catch (error) {
    logger.error('获取Forum Topics失败', error instanceof Error ? error : undefined);
    return c.json({ error: 'Failed to fetch forum topics' }, 500);
  }
});

export default app;
