import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().default('./data/db.sqlite'),
  TELEGRAM_API_ID: z.string(),
  TELEGRAM_API_HASH: z.string(),

  // AI Provider 配置
  AI_PROVIDER: z.enum(['mock', 'openai', 'deepseek', 'gemini', 'custom']).default('mock'),
  AI_API_KEY: z.string().optional(),
  AI_API_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().default('deepseek-chat'),

  // Gemini 专用配置
  GEMINI_API_KEY: z.string().optional(),

  // Web Push VAPID 配置
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
});

export const env = envSchema.parse(process.env);
