import OpenAI from 'openai';
import { logger } from '../../../utils/logger';
import type { AIProvider, GenerateOptions, GenerateResponse } from './base';

/**
 * OpenAI 兼容的 AI Provider
 * 支持 OpenAI、Deepseek、GPT-4o 等所有 OpenAI API 兼容的服务
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseURL?: string; model: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.defaultModel = config.model;
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      });

      const duration = Date.now() - startTime;

      logger.info('OpenAI Provider 生成完成', {
        model: completion.model,
        tokens: completion.usage?.total_tokens,
        duration: `${duration}ms`,
      });

      return {
        content: completion.choices[0]?.message?.content || '',
        tokensUsed: completion.usage?.total_tokens || 0,
        model: completion.model,
      };
    } catch (error) {
      logger.error('OpenAI Provider 生成失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }
}
