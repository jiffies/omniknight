import type { InferSelectModel } from '@omniknight/db';
import type { groups, messages, summaries, filterRules, summaryJobs } from '@omniknight/db';

// 数据库模型类型
export type Group = InferSelectModel<typeof groups>;
export type Message = InferSelectModel<typeof messages>;
export type Summary = InferSelectModel<typeof summaries>;
export type FilterRule = InferSelectModel<typeof filterRules>;
export type SummaryJob = InferSelectModel<typeof summaryJobs>;

// 扩展类型
export type SummaryWithGroup = Summary & {
  group: Group;
};

export type GroupWithStats = Group & {
  messageCount: number;
  summaryCount: number;
  lastMessage?: Message;
};

// 过滤器配置类型
export interface LengthFilterConfig {
  minLength: number;
  maxLength: number;
}

export interface KeywordFilterConfig {
  mode: 'blacklist' | 'whitelist';
  keywords: string[];
  caseSensitive: boolean;
}

export interface EmojiFilterConfig {
  emojiOnly: boolean;
  maxEmojiRatio: number;
}

export type FilterConfig = LengthFilterConfig | KeywordFilterConfig | EmojiFilterConfig;

// AI 配置类型
export interface AIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
