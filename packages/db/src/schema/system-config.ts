import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON 字符串
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
