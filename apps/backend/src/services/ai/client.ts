import { db, systemConfig } from '@omniknight/db';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { AIProvider, GenerateOptions, GenerateResponse } from './providers';
import { GeminiProvider } from './providers/gemini';
import { MockAIProvider } from './providers/mock';
import { OpenAIProvider } from './providers/openai';

/**
 * 从数据库读取配置值，如果不存在则返回默认值
 */
async function getConfigValue(key: string, defaultValue: string): Promise<string> {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, key),
    });
    return config?.value || defaultValue;
  } catch (error) {
    logger.warn(`读取配置失败: ${key}，使用默认值`, { error });
    return defaultValue;
  }
}

/**
 * AI 客户端管理器
 * 每次调用时动态从数据库读取配置
 */
class AIClient {
  private async createProvider(): Promise<AIProvider> {
    // 从数据库读取配置，优先使用数据库配置，其次是环境变量
    const providerType = await getConfigValue('ai_provider', env.AI_PROVIDER || 'mock');
    const model = await getConfigValue('ai_model', env.AI_MODEL);

    logger.info('AI Provider 配置', {
      providerType,
      model,
      vertexProject: providerType === 'gemini' ? env.GOOGLE_CLOUD_PROJECT : undefined,
      vertexLocation: providerType === 'gemini' ? env.GOOGLE_CLOUD_LOCATION : undefined,
    });

    switch (providerType) {
      case 'mock':
        return new MockAIProvider();

      case 'openai':
      case 'deepseek':
      case 'custom':
        if (!env.AI_API_KEY) {
          throw new Error('AI_API_KEY is required for OpenAI/DeepSeek/Custom provider');
        }
        return new OpenAIProvider({
          apiKey: env.AI_API_KEY,
          baseURL: env.AI_API_BASE_URL,
          model,
        });

      case 'gemini': {
        if (!env.GOOGLE_CLOUD_PROJECT) {
          throw new Error('GOOGLE_CLOUD_PROJECT is required for Gemini Vertex AI provider');
        }

        return new GeminiProvider({
          project: env.GOOGLE_CLOUD_PROJECT,
          location: env.GOOGLE_CLOUD_LOCATION,
          model,
        });
      }

      default:
        logger.warn(`未知的 AI Provider: ${providerType}，使用 Mock Provider`);
        return new MockAIProvider();
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    // 每次调用时动态创建 provider，以获取最新配置
    const provider = await this.createProvider();

    // 从数据库读取温度参数
    const temperatureStr = await getConfigValue('ai_temperature', '0.7');
    const temperature = Number.parseFloat(temperatureStr) || 0.7;

    // 合并温度参数
    const finalOptions = {
      ...options,
      temperature: options.temperature ?? temperature,
    };

    return provider.generate(finalOptions);
  }

  async getProviderName(): Promise<string> {
    const provider = await this.createProvider();
    return provider.name;
  }
}

export const aiClient = new AIClient();

export async function generateCompletion(options: GenerateOptions): Promise<GenerateResponse> {
  return aiClient.generate(options);
}
