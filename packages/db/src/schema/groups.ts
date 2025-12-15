import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const groups = sqliteTable(
  'groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    telegramId: text('telegram_id').notNull().unique(),
    title: text('title').notNull(),
    username: text('username'),
    type: text('type', { enum: ['group', 'channel', 'supergroup', 'forum'] }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    // Forum Topic 支持
    topicId: integer('topic_id'), // Forum Topic ID（仅forum类型的子topic有值）
    parentGroupId: integer('parent_group_id'), // 父群组ID（仅topic有值）
    isTopic: integer('is_topic', { mode: 'boolean' }).notNull().default(false), // 是否是Topic

    // 总结配置
    summaryEnabled: integer('summary_enabled', { mode: 'boolean' }).notNull().default(true),
    summaryInterval: integer('summary_interval').notNull().default(6), // 小时
    minMessagesForSummary: integer('min_messages_for_summary').notNull().default(20),

    // 元数据
    lastMessageId: integer('last_message_id'),
    lastSummaryAt: integer('last_summary_at', { mode: 'timestamp' }),
    lastSyncedMessageId: integer('last_synced_message_id'), // 最后同步的消息ID（用于增量拉取）
    rateLimitState: text('rate_limit_state'), // JSON 格式存储限流状态（可选，用于调试）
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    telegramIdIdx: index('idx_groups_telegram_id').on(table.telegramId),
    activeIdx: index('idx_groups_active').on(table.isActive),
  })
);
