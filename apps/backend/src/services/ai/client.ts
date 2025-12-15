import type { AIProvider, GenerateOptions, GenerateResponse } from './providers';
import { MockAIProvider } from './providers/mock';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * AI 客户端管理器
 * 根据配置选择不同的 AI Provider
 */
class AIClient {
  private provider: AIProvider;

  constructor() {
    this.provider = this.createProvider();
    logger.info(`AI Provider 已初始化: ${this.provider.name}`);
  }

  private createProvider(): AIProvider {
    const providerType = env.AI_PROVIDER || 'mock';

    switch (providerType) {
      case 'mock':
        return new MockAIProvider();

      case 'openai':
      case 'deepseek':
      case 'custom':
        return new OpenAIProvider({
          apiKey: env.AI_API_KEY,
          baseURL: env.AI_API_BASE_URL,
          model: env.AI_MODEL,
        });

      case 'gemini':
        return new GeminiProvider({
          apiKey: env.GEMINI_API_KEY || env.AI_API_KEY,
          model: env.AI_MODEL || 'gemini-2.5-flash',
        });

      default:
        logger.warn(`未知的 AI Provider: ${providerType}，使用 Mock Provider`);
        return new MockAIProvider();
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    return this.provider.generate(options);
  }

  getProviderName(): string {
    return this.provider.name;
  }
}

export const aiClient = new AIClient();

export async function generateCompletion(options: GenerateOptions): Promise<GenerateResponse> {
  return aiClient.generate(options);
}
