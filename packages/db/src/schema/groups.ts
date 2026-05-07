import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { telegramAccounts } from './telegram-accounts';

export const groups = sqliteTable(
  'groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    telegramId: text('telegram_id').notNull(),
    title: text('title').notNull(), // 完整标题（用于兼容旧数据）
    username: text('username'),
    type: text('type', { enum: ['group', 'channel', 'supergroup', 'forum'] }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    // 账号关联
    accountId: integer('account_id')
      .notNull()
      .references(() => telegramAccounts.id, { onDelete: 'cascade' }),

    // Forum Topic 支持
    topicId: integer('topic_id'), // Forum Topic ID（仅forum类型的子topic有值）
    parentGroupId: integer('parent_group_id'), // 父群组ID（仅topic有值）
    isTopic: integer('is_topic', { mode: 'boolean' }).notNull().default(false), // 是否是Topic

    // 分离的名称字段（用于树形展示）
    groupName: text('group_name'), // 父 group/forum 的名称
    topicName: text('topic_name'), // topic 的名称（仅当 isTopic=true 时有值）

    // 总结配置
    summaryEnabled: integer('summary_enabled', { mode: 'boolean' }).notNull().default(true),
    summaryInterval: integer('summary_interval').notNull().default(6), // 小时
    summaryStartTime: text('summary_start_time'), // HH:mm，可选的本地调度开始时间
    minMessagesForSummary: integer('min_messages_for_summary').notNull().default(20),
    customPrompt: text('custom_prompt'), // 用户自定义提示词

    // 元数据
    lastMessageId: integer('last_message_id'),
    lastSummaryAt: integer('last_summary_at', { mode: 'timestamp' }),
    lastSyncedMessageId: integer('last_synced_message_id'), // 最后同步的消息ID（用于增量拉取）
    rateLimitState: text('rate_limit_state'), // JSON 格式存储限流状态（可选，用于调试）
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // 组合唯一约束：同一个telegram_id可以有多个topics（通过topicId区分）
    telegramTopicUnique: uniqueIndex('idx_groups_telegram_topic_unique').on(
      table.telegramId,
      table.topicId,
    ),
    telegramIdIdx: index('idx_groups_telegram_id').on(table.telegramId),
    activeIdx: index('idx_groups_active').on(table.isActive),
    accountIdIdx: index('idx_groups_account_id').on(table.accountId),
  }),
);
