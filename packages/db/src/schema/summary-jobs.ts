import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { groups } from './groups';

export const summaryJobs = sqliteTable(
  'summary_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),

    // 任务类型
    taskType: text('task_type', {
      enum: ['manual', 'scheduled'],
    })
      .notNull()
      .default('manual'),

    // 时间范围
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),

    // 任务状态
    status: text('status', {
      enum: ['pending', 'fetching', 'summarizing', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),

    // 进度信息
    progress: integer('progress').notNull().default(0), // 0-100
    currentMessageId: integer('current_message_id'),
    fetchedCount: integer('fetched_count').notNull().default(0),

    // 错误处理
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),

    // 时间戳
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    nextRetryAt: integer('next_retry_at', { mode: 'timestamp' }),
  },
  (table) => ({
    groupStatusIdx: index('idx_summary_jobs_group_status').on(table.groupId, table.status),
    statusIdx: index('idx_summary_jobs_status').on(table.status),
    scheduledIdx: index('idx_summary_jobs_scheduled').on(table.scheduledAt),
  })
);
