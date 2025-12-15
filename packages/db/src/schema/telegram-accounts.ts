import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const telegramAccounts = sqliteTable(
  'telegram_accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // 账号标识信息
    phoneNumber: text('phone_number').notNull().unique(),
    userId: text('user_id'), // Telegram User ID
    username: text('username'), // @username
    firstName: text('first_name'),
    lastName: text('last_name'),

    // Session 数据
    sessionString: text('session_string').notNull(),

    // 状态管理
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    isConnected: integer('is_connected', { mode: 'boolean' }).notNull().default(false),

    // 时间戳
    lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    phoneNumberIdx: index('idx_telegram_accounts_phone').on(table.phoneNumber),
    activeIdx: index('idx_telegram_accounts_active').on(table.isActive),
  }),
);
