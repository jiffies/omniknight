import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { groups } from './groups';

export const summaries = sqliteTable(
  'summaries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),

    // 时间范围
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),

    // 总结内容
    content: text('content').notNull(),
    title: text('title').notNull(),

    // 统计信息
    messageCount: integer('message_count').notNull(),
    totalMessagesInPeriod: integer('total_messages_in_period').notNull(),
    fetchedMessageCount: integer('fetched_message_count'), // 实际拉取的消息数
    filteredMessageCount: integer('filtered_message_count'), // 过滤后的消息数
    fetchDuration: integer('fetch_duration'), // 拉取耗时（毫秒）
    floodWaitCount: integer('flood_wait_count').default(0), // 遇到 FLOOD_WAIT 次数

    // AI 元数据
    aiModel: text('ai_model').notNull(),
    tokensUsed: integer('tokens_used'),
    generationTime: integer('generation_time'), // 毫秒

    // 状态
    status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] })
      .notNull()
      .default('completed'),
    errorMessage: text('error_message'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    groupDateIdx: index('idx_summaries_group_date').on(table.groupId, table.periodEnd),
    statusIdx: index('idx_summaries_status').on(table.status),
  })
);
