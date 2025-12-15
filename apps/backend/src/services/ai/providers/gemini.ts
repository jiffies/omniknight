import { GoogleGenAI } from '@google/genai';
import type { AIProvider, GenerateOptions, GenerateResponse, AIMessage } from './base';
import { logger } from '../../../utils/logger';

/**
 * Google Gemini AI Provider
 * 使用 Google 官方 @google/genai SDK
 * 支持 Gemini 2.5 Flash 及其他 Gemini 模型
 */
export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private client: GoogleGenAI;
  private defaultModel: string;

  constructor(config: { apiKey: string; model: string }) {
    this.client = new GoogleGenAI({
      apiKey: config.apiKey,
    });
    this.defaultModel = config.model;
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // 1. 转换消息格式
      const contents = this.convertMessages(options.messages);

      // 2. 构建配置
      const config = {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      };

      // 3. 调用 Gemini API
      const response = await this.client.models.generateContent({
        model: this.defaultModel,
        contents: contents,
        config: config,
      });

      const duration = Date.now() - startTime;

      // 4. 提取 token 使用量
      const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

      // 5. 提取生成的内容
      const content = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      logger.info('Gemini Provider 生成完成', {
        model: this.defaultModel,
        tokens: tokensUsed,
        duration: `${duration}ms`,
        promptTokens: response.usageMetadata?.promptTokenCount,
        candidateTokens: response.usageMetadata?.candidatesTokenCount,
      });

      return {
        content,
        tokensUsed,
        model: this.defaultModel,
      };
    } catch (error) {
      logger.error('Gemini Provider 生成失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * 将标准 AIMessage 格式转换为 Gemini API 要求的格式
   *
   * 转换规则:
   * - system/user -> role: 'user'
   * - assistant -> role: 'model'
   * - content -> parts: [{ text }]
   */
  private convertMessages(messages: AIMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map((msg) => {
      // Gemini API 使用 'user' 和 'model' 作为角色
      // system 消息需要转换为 user 消息
      const role = msg.role === 'assistant' ? 'model' : 'user';

      return {
        role,
        parts: [{ text: msg.content }],
      };
    });
  }
}
