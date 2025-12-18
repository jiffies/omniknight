import type { Group, Message } from '@omniknight/shared';

export const SYSTEM_PROMPT = `你是一个 Telegram 群组内容总结助手。你的任务是从大量群聊消息中提取有价值的信息，生成结构化的 Markdown 总结。

## 总结原则
1. 聚焦核心话题：识别讨论的主要主题和热点话题
2. 提取关键信息：技术方案、产品推荐、重要数据统计
3. 保留有价值的观点：专家意见、深度分析、实用建议
4. 过滤噪音：忽略闲聊、灌水、无意义的对话
5. 结构清晰：使用标题、列表、引用等 Markdown 格式
6. 多输出信息，具体的内容，而不是高度概括, 帮助读者获取足够的信息量。
例如同一个群组不同时间段的总结应该输出差别很大的具体内容，而不是相似的概括性内容。

## 输出格式
- Topic: （你从记录中提取的主题名/群名）
- Messages: （消息总数，如记录未提供则写“未提供”）
- Time range: （按记录给出的时区与起止时间）

🔥 热门话题（Top 3-7）：
- 每条：话题名 + 一句解释

🧠 关键观点（按人物/来源归纳）
- 每位关键发言者：用 1-4 条要点概括其主张
- 每条要点末尾标注可信度：高/中/低（依据：是否多次被提及、是否给出证据、是否被反驳）
- 严禁把“观点”写成“事实”

📝 重点信息清单
主要关于新行业，新方向和赚钱机会

💬 代表性原话引用（可选，1-5 条）
- 只引用记录中出现的原句；每条不超过 25 字；用于支撑摘要判断
`;

export function buildSummaryPrompt(
  group: Group,
  messages: Message[],
  periodStart: Date,
  periodEnd: Date,
): string {
  const formattedMessages = messages.map((m) => {
    const time = formatTime(m.date);
    return `[${time}] ${m.senderName}: ${m.text}`;
  });

  // 构建用户提示词部分
  const customPromptSection = group.customPrompt
    ? `\n\n## 用户自定义要求\n${group.customPrompt}\n`
    : '';

  return `
请总结以下 Telegram 群组的消息内容：

**群组信息**
- 群组名称：${group.title}
- 时间范围：${formatDateTime(periodStart)} 至 ${formatDateTime(periodEnd)}
- 消息数量：${messages.length} 条
${customPromptSection}
**消息内容**
---
${formattedMessages.join('\n')}
---

请严格按照系统提示词中的输出格式生成总结${group.customPrompt ? '，同时遵循上述用户自定义要求' : ''}。标题使用格式：[Summary] Topic: ${group.title} (${messages.length} messages)
`.trim();
}

/**
 * 构建完整的系统提示词（包含用户自定义部分）
 */
export function buildSystemPrompt(group: Group): string {
  if (!group.customPrompt) {
    return SYSTEM_PROMPT;
  }

  return `${SYSTEM_PROMPT}

---

## 📌 群组特定要求

${group.customPrompt}

请在生成总结时同时遵循以上系统规则和群组特定要求。`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
