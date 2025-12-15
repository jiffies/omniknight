import { z } from 'zod';

// 群组相关 Schema
export const createGroupSchema = z.object({
  telegramId: z.string(),
  title: z.string().min(1),
  username: z.string().optional(),
  type: z.enum(['group', 'channel', 'supergroup', 'forum']),
  accountId: z.number(), // 账号ID（必填）
  topicId: z.number().optional(),
  parentGroupId: z.number().optional(),
  isTopic: z.boolean().default(false),
  groupName: z.string().optional(), // 父 group/forum 的名称
  topicName: z.string().optional(), // topic 的名称（仅当 isTopic=true 时有值）
});

export const updateGroupSchema = z.object({
  isActive: z.boolean().optional(),
  summaryEnabled: z.boolean().optional(),
  summaryInterval: z.number().min(1).max(24).optional(),
  minMessagesForSummary: z.number().min(1).optional(),
  customPrompt: z.string().optional(), // 用户自定义提示词
});

// 总结相关 Schema
export const generateSummarySchema = z.object({
  groupId: z.number(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

export const querySummariesSchema = z.object({
  groupId: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// 过滤规则 Schema
export const createFilterRuleSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['length', 'keyword', 'emoji', 'media', 'custom']),
  config: z.record(z.unknown()),
  priority: z.number().default(100),
});

export const updateFilterRuleSchema = z.object({
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
  priority: z.number().optional(),
});

// 账号相关 Schema
export const createAccountSchema = z.object({
  phoneNumber: z.string().min(1),
});

export const updateAccountSchema = z.object({
  isActive: z.boolean().optional(),
});
