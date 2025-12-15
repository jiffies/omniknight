import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const filterRules = sqliteTable(
  'filter_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    type: text('type', {
      enum: ['length', 'keyword', 'emoji', 'media', 'custom'],
    }).notNull(),
    config: text('config').notNull(), // JSON string
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    priority: integer('priority').notNull().default(100),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    nameIdx: index('filter_rules_name_unique').on(table.name),
    enabledPriorityIdx: index('idx_filter_rules_enabled_priority').on(
      table.isEnabled,
      table.priority
    ),
  })
);
