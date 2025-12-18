import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // Web Push 订阅信息
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(), // 加密密钥
  auth: text('auth').notNull(), // 认证密钥

  // 用户代理信息（可选，用于调试）
  userAgent: text('user_agent'),

  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
