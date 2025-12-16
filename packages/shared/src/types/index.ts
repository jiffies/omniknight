import type { InferSelectModel } from '@omniknight/db';
import type { filterRules, groups, summaries, summaryJobs } from '@omniknight/db';

// 数据库模型类型
export type Group = InferSelectModel<typeof groups>;
export type Summary = InferSelectModel<typeof summaries>;
export type FilterRule = InferSelectModel<typeof filterRules>;
export type SummaryJob = InferSelectModel<typeof summaryJobs>;

// 消息类型（仅用于内存，不保存到数据库）
export interface Message {
  id: number;
  text: string;
  date: Date;
  senderId?: string;
  senderName?: string;
  isForwarded: boolean;
  hasMedia: boolean;
  mediaType?: string;
  isFiltered: boolean;
  filterReason?: string;
}

// 扩展类型
export type SummaryWithGroup = Summary & {
  group: Group;
};

export type GroupWithStats = Group & {
  messageCount: number;
  summaryCount: number;
  lastMessage?: Message;
  accountInfo: {
    id: number;
    phoneNumber: string;
    username: string | null;
    isConnected: boolean;
  } | null;
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
