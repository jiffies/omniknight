import { logger } from '../../../utils/logger';
import type { AIProvider, GenerateOptions, GenerateResponse } from './base';

/**
 * Mock AI Provider - 用于测试
 * 不调用真实 API，通过简单的字符串拼接生成总结
 */
export class MockAIProvider implements AIProvider {
  name = 'mock-ai';

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    logger.info('使用 Mock AI Provider 生成总结');

    const userMessage = options.messages.find((m) => m.role === 'user');
    if (!userMessage) {
      throw new Error('No user message found');
    }

    // 从用户消息中提取信息
    const content = this.generateMockSummary(userMessage.content);

    // 模拟 Token 计数（简单估算：字符数 / 3）
    const tokensUsed = Math.ceil(content.length / 3);

    // 模拟少量延迟，让它看起来像真实的 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      content,
      tokensUsed,
      model: 'mock-v1',
    };
  }

  private generateMockSummary(userContent: string): string {
    // 提取群组名称
    const groupNameMatch = userContent.match(/群组名称：(.+)/);
    const groupName = groupNameMatch?.[1] || '未知群组';

    // 提取时间范围
    const timeRangeMatch = userContent.match(/时间范围：(.+)/);
    const timeRange = timeRangeMatch?.[1] || '未知时间';

    // 提取消息数量
    const messageCountMatch = userContent.match(/消息数量：(\d+)/);
    const messageCount = messageCountMatch?.[1] || '0';

    // 提取一些示例消息（取前3条）
    const messagesSection = userContent.split('**消息内容**')[1];
    const messageLines = messagesSection
      ?.split('\n')
      .filter((line) => line.trim() && line.includes(':'))
      .slice(0, 5);

    const topics = this.extractTopics(messageLines || []);
    const keywords = this.extractKeywords(messageLines || []);

    // 生成模拟总结
    return `# ${groupName} - 群组动态总结

## 📊 概览信息

- **时间范围**: ${timeRange}
- **消息数量**: ${messageCount} 条
- **活跃程度**: ${this.getActivityLevel(Number.parseInt(messageCount))}

## 🔥 核心话题

${topics.map((topic, i) => `${i + 1}. **${topic}** - 群内成员讨论了相关内容`).join('\n')}

## 💬 重点讨论

### 主要内容
${
  messageLines
    ?.slice(0, 3)
    .map((line) => `- ${line.trim()}`)
    .join('\n') || '暂无重点讨论内容'
}

### 关键词
${keywords.map((kw) => `\`${kw}\``).join(' ')}

## 📈 数据统计

- **消息总数**: ${messageCount}
- **分析时段**: ${timeRange}
- **AI 模型**: Mock Provider (测试模式)

---

> ⚠️ 这是 Mock AI 生成的测试总结，实际部署时请切换到真实的 AI Provider
`;
  }

  private extractTopics(messages: string[]): string[] {
    const commonTopics = ['项目进展', '技术讨论', '市场动态', '团队协作', '问题解决', '经验分享'];

    // 简单逻辑：根据消息数量返回不同数量的话题
    const topicCount = Math.min(3, Math.max(1, Math.floor(messages.length / 2)));
    return commonTopics.slice(0, topicCount);
  }

  private extractKeywords(messages: string[]): string[] {
    // 从消息中提取关键词（优化版，支持中英文）
    const keywords = new Set<string>();

    for (const msg of messages) {
      // 移除时间戳和用户名前缀 [HH:MM] username:
      const cleanMsg = msg.replace(/^\[.*?\]\s*\w+:\s*/, '');

      // 提取英文单词（2-15个字符）
      const englishWords = cleanMsg.match(/[a-zA-Z]{2,15}/g) || [];
      for (const word of englishWords.filter((w) => w.length >= 3).slice(0, 3)) {
        keywords.add(word.toLowerCase());
      }

      // 提取中文词组（2-6个字符的连续中文）
      const chineseWords = cleanMsg.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
      for (const word of chineseWords.slice(0, 2)) {
        keywords.add(word);
      }

      // 提取数字（可能是重要的数据）
      const numbers = cleanMsg.match(/\d+/g) || [];
      if (numbers.length > 0 && numbers.length < 3) {
        for (const n of numbers) {
          if (Number.parseInt(n) > 10) {
            // 只保留大于10的数字，过滤掉时间
            keywords.add(n);
          }
        }
      }

      if (keywords.size >= 9) break;
    }

    return Array.from(keywords).slice(0, 9);
  }

  private getActivityLevel(messageCount: number): string {
    if (messageCount >= 100) return '🔥 极高';
    if (messageCount >= 50) return '📈 较高';
    if (messageCount >= 20) return '📊 中等';
    return '📉 较低';
  }
}
