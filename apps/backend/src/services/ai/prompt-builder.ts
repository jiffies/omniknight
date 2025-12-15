import type { Message, Group } from '@omniknight/shared';

export const SYSTEM_PROMPT = `你是一个 Telegram 群组内容总结助手。你的任务是从大量群聊消息中提取有价值的信息，生成结构化的 Markdown 总结。

## 总结原则
1. **聚焦核心话题**：识别讨论的主要主题和热点话题
2. **提取关键信息**：技术方案、产品推荐、重要数据统计
3. **保留有价值的观点**：专家意见、深度分析、实用建议
4. **过滤噪音**：忽略闲聊、灌水、无意义的对话
5. **结构清晰**：使用标题、列表、引用等 Markdown 格式

## 输出格式
[Summary] Topic: {群组名称} ({消息数量} messages)
⚠️ AI有幻觉，总结只作参考

时间范围：{开始时间} 至 {结束时间}

---

🔥 热门话题：
- 话题1简述
- 话题2简述

🗣️ {关键人物}说：（如果有重要发言者）
- 观点摘要

📝 重点摘要：
- {话题名称}：
    - 关键观点1
    - 关键观点2
    - 建议或结论

注意：
- 不要包含"资源与链接"部分
- 时间格式使用 YYYY-MM-DD HH:mm
- 使用 emoji 让内容更生动
`;

export function buildSummaryPrompt(
  group: Group,
  messages: Message[],
  periodStart: Date,
  periodEnd: Date
): string {
  const formattedMessages = messages.map((m) => {
    const time = formatTime(m.date);
    return `[${time}] ${m.senderName}: ${m.text}`;
  });

  return `
请总结以下 Telegram 群组的消息内容：

**群组信息**
- 群组名称：${group.title}
- 时间范围：${formatDateTime(periodStart)} 至 ${formatDateTime(periodEnd)}
- 消息数量：${messages.length} 条

**消息内容**
---
${formattedMessages.join('\n')}
---

请严格按照系统提示词中的输出格式生成总结。标题使用格式：[Summary] Topic: ${group.title} (${messages.length} messages)
`.trim();
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
