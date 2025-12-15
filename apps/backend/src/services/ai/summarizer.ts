import { db, groups, summaries } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { generateCompletion } from './client';
import { buildSummaryPrompt, buildSystemPrompt } from './prompt-builder';
import { telegramAccountManager } from '../telegram/account-manager';
import { fetchMessagesWithRateLimit } from '../telegram/message-fetcher';
import { messageCache } from '../telegram/message-cache';

export async function generateSummary(
  groupId: number,
  periodStart: Date,
  periodEnd: Date,
  onProgress?: (update: { progress: number; fetchedCount: number }) => Promise<void>
) {
  const startTime = Date.now();
  let fetchDuration = 0;
  let floodWaitCount = 0;

  logger.info('========================================');
  logger.info('📝 开始生成总结', { groupId });
  logger.info('========================================');

  // 1. 获取群组信息
  logger.info('[1/10] 正在获取群组信息...');
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });

  if (!group) {
    logger.error('[1/10] ❌ 群组不存在', { groupId });
    throw new Error(`Group ${groupId} not found`);
  }
  logger.info('[1/10] ✅ 群组信息获取成功', {
    groupName: group.title,
    telegramId: group.telegramId
  });

  // 2. 检查消息缓存
  logger.info('[2/10] 正在检查消息缓存...');
  let fetchedMessages = messageCache.get(groupId, periodStart, periodEnd);

  if (fetchedMessages) {
    logger.info('[2/10] ✅ 使用缓存的消息');
    fetchDuration = 0; // 使用缓存，拉取时间为0
  } else {
    // 3. 获取 Telegram 客户端（基于群组关联的账号）
    logger.info('[3/10] 正在获取 Telegram 客户端...', { accountId: group.accountId });
    const clientWrapper = await telegramAccountManager.getClient(group.accountId);
    const client = clientWrapper.getClient();
    logger.info('[3/10] ✅ Telegram 客户端已就绪', { accountId: group.accountId });

    // 4. 拉取消息（带限流保护）
    const fetchStartTime = Date.now();
    logger.info('[4/10] 开始拉取消息(带自适应限流保护)', {
      groupId,
      telegramId: group.telegramId,
      period: `${periodStart.toISOString()} ~ ${periodEnd.toISOString()}`,
      topicId: group.topicId ?? '无(普通群组)',
    });

    fetchedMessages = await fetchMessagesWithRateLimit(
      client,
      group.telegramId,
      periodStart,
      periodEnd,
      onProgress,
      group.topicId ?? undefined // 🔥 如果是Forum Topic，传递topicId
    );

    fetchDuration = Date.now() - fetchStartTime;
    logger.info('[4/10] ✅ 消息拉取完成', {
      拉取数量: fetchedMessages.length,
      耗时: `${(fetchDuration / 1000).toFixed(1)}秒`,
    });

    // 5. 缓存拉取的消息（10分钟）
    messageCache.set(groupId, periodStart, periodEnd, fetchedMessages);
  }

  // 6. 过滤出未被过滤的消息
  logger.info('[6/10] 正在应用消息过滤规则...');
  const validMessages = fetchedMessages.filter((msg) => !msg.isFiltered);
  const filteredCount = fetchedMessages.length - validMessages.length;
  logger.info('[6/10] ✅ 消息过滤完成', {
    总消息数: fetchedMessages.length,
    有效消息: validMessages.length,
    已过滤: filteredCount,
    过滤率: `${((filteredCount / fetchedMessages.length) * 100).toFixed(1)}%`,
  });

  // 7. 检查消息数量阈值
  logger.info('[7/10] 检查消息数量阈值...', {
    有效消息数: validMessages.length,
    最小阈值: group.minMessagesForSummary,
  });

  if (validMessages.length < group.minMessagesForSummary) {
    logger.warn('[7/10] ⚠️ 消息数量不足，跳过总结', {
      groupId,
      messageCount: validMessages.length,
      threshold: group.minMessagesForSummary,
    });
    logger.info('========================================');
    return null;
  }
  logger.info('[7/10] ✅ 消息数量满足要求');

  // 8. 构建 Prompt
  logger.info('[8/10] 正在构建 AI Prompt...');
  const userPrompt = buildSummaryPrompt(
    group,
    validMessages as any, // fetchedMessages 与 Message 类型兼容
    periodStart,
    periodEnd
  );
  logger.info('[8/10] ✅ Prompt 构建完成', {
    消息数量: validMessages.length,
    Prompt长度: userPrompt.length,
  });

  // 9. 调用 AI 生成总结（带重试，指数退避）
  logger.info('[9/10] 🤖 正在调用 AI 生成总结（支持自动重试）...');
  const aiResponse = await generateCompletionWithRetry({
    messages: [
      { role: 'system', content: buildSystemPrompt(group) },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
  });
  logger.info('[9/10] ✅ AI 生成完成', {
    模型: aiResponse.model,
    Token消耗: aiResponse.tokensUsed,
    内容长度: aiResponse.content.length,
  });

  // 9. 提取标题
  logger.info('[9/10] 正在提取总结标题...');
  const title = extractTitle(aiResponse.content) || '群组总结';
  logger.info('[9/10] ✅ 标题提取完成', { title });

  // 10. 保存总结到数据库
  logger.info('[10/10] 正在保存总结到数据库...');
  const [summary] = await db
    .insert(summaries)
    .values({
      groupId,
      periodStart,
      periodEnd,
      content: aiResponse.content,
      title,
      messageCount: validMessages.length,
      totalMessagesInPeriod: validMessages.length,
      fetchedMessageCount: fetchedMessages.length,
      filteredMessageCount: validMessages.length,
      fetchDuration,
      floodWaitCount,
      aiModel: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      generationTime: Date.now() - startTime,
      status: 'completed',
      createdAt: new Date(),
    })
    .returning();
  logger.info('[10/10] ✅ 总结已保存', { summaryId: summary?.id });

  // 11. 更新群组最后总结时间
  logger.info('正在更新群组状态...');
  await db
    .update(groups)
    .set({
      lastSummaryAt: new Date(),
      lastSyncedMessageId: fetchedMessages[fetchedMessages.length - 1]?.id,
    })
    .where(eq(groups.id, groupId));
  logger.info('✅ 群组状态已更新');

  logger.info('========================================');
  logger.info('🎉 总结生成成功!', {
    summaryId: summary.id,
    groupId,
    groupName: group.title,
    title,
    消息数量: validMessages.length,
    Token消耗: aiResponse.tokensUsed,
    总耗时: `${((Date.now() - startTime) / 1000).toFixed(1)}秒`,
  });
  logger.info('========================================');

  return summary;
}

// 简单采样：按时间均匀采样
function sampleMessages<T extends { id: number; date: Date }>(
  messages: T[],
  targetCount: number
): T[] {
  if (messages.length <= targetCount) {
    return messages;
  }

  const step = messages.length / targetCount;
  const sampled: Message[] = [];

  for (let i = 0; i < targetCount; i++) {
    const index = Math.floor(i * step);
    sampled.push(messages[index]!);
  }

  return sampled;
}

// 从 Markdown 中提取第一个一级标题
function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的 AI 生成函数（指数退避）
 */
async function generateCompletionWithRetry(
  params: Parameters<typeof generateCompletion>[0],
  maxRetries = 5
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`AI 调用尝试 ${attempt}/${maxRetries}`);
      const result = await generateCompletion(params);

      if (attempt > 1) {
        logger.info('✅ 重试成功', { attempt, maxRetries });
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.warn(`AI 调用失败 (尝试 ${attempt}/${maxRetries})`, {
        error: errorMessage,
        attempt,
        maxRetries,
      });

      // 如果还有重试机会，使用指数退避
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * (2 ** (attempt - 1)), 30000); // 最大等待30秒
        logger.info(`⏳ ${delayMs}ms 后重试...`, {
          nextAttempt: attempt + 1,
          delayMs,
          formula: `min(1000 * 2^${attempt - 1}, 30000)`,
        });

        await sleep(delayMs);
      }
    }
  }

  // 所有重试都失败
  logger.error('❌ AI 调用失败，已达到最大重试次数', {
    maxRetries,
    lastError: lastError?.message,
  });

  throw lastError || new Error('AI generation failed after all retries');
}
