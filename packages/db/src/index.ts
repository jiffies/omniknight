import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index';

// 数据库连接
const dbPath = process.env.DATABASE_PATH || './data/db.sqlite';
const sqlite = new Database(dbPath);

// 启用 WAL 模式以提高并发性能
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

// 导出 schema 和类型
export * from './schema/index';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
