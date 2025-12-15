import type { Message } from '@omniknight/shared';
import { db, filterRules } from '@omniknight/db';
import { eq } from 'drizzle-orm';

interface FilterResult {
  isFiltered: boolean;
  filterReason?: string;
}

// 从数据库实时读取过滤规则（无缓存，配置立即生效）
export async function applyQuickFilters(message: Partial<Message>): Promise<FilterResult> {
  try {
    // 🔥 每次都查询数据库，确保配置实时生效
    const rules = await db.query.filterRules.findMany({
      where: eq(filterRules.isEnabled, true),
      orderBy: (filterRules, { asc }) => [asc(filterRules.priority)],
    });

    // 应用规则
    for (const rule of rules) {
      const config = JSON.parse(rule.config);
      const result = applyRule(message, rule.type, config);
      if (result.isFiltered) {
        return result;
      }
    }

    return { isFiltered: false };
  } catch (error) {
    // 如果数据库查询失败，返回不过滤（确保消息不会丢失）
    console.error('过滤规则查询失败:', error);
    return { isFiltered: false };
  }
}

// 规则应用函数
function applyRule(
  message: Partial<Message>,
  type: string,
  config: Record<string, unknown>
): FilterResult {
  const text = message.text || '';

  switch (type) {
    case 'length': {
      const minLength = (config.minLength as number) || 0;
      const maxLength = (config.maxLength as number) || Number.POSITIVE_INFINITY;
      if (text.length < minLength || text.length > maxLength) {
        return { isFiltered: true, filterReason: `length_${type}` };
      }
      break;
    }

    case 'keyword': {
      const keywords = (config.keywords as string[]) || [];
      const caseSensitive = config.caseSensitive as boolean;
      const mode = config.mode as string;

      const matched = keywords.some((kw: string) =>
        caseSensitive ? text.includes(kw) : text.toLowerCase().includes(kw.toLowerCase())
      );

      if (mode === 'blacklist' && matched) {
        return { isFiltered: true, filterReason: 'keyword_blacklist' };
      }
      if (mode === 'whitelist' && !matched && text.trim()) {
        return { isFiltered: true, filterReason: 'keyword_not_whitelisted' };
      }
      break;
    }

    case 'emoji': {
      if (config.emojiOnly && isEmojiOnly(text)) {
        return { isFiltered: true, filterReason: 'emoji_only' };
      }
      break;
    }

    case 'media': {
      if (message.hasMedia && !text.trim()) {
        return { isFiltered: true, filterReason: 'media_only' };
      }
      break;
    }
  }

  return { isFiltered: false };
}

function isEmojiOnly(text: string): boolean {
  // 移除所有 emoji 和空白字符
  const textWithoutEmoji = text.replace(/[\p{Emoji}\s]/gu, '');
  return textWithoutEmoji.length === 0 && text.length > 0;
}
