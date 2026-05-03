import type { Content, GenerateContentConfig } from '@google/genai';
import { logger } from '../../../utils/logger';
import type { AIMessage, AIProvider, GenerateOptions, GenerateResponse } from './base';
import { getGeminiVertexClient } from './gemini-client';

/**
 * Google Gemini AI Provider
 * 使用 Google 官方 @google/genai SDK 通过 Vertex AI 访问 Gemini
 */
export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private project: string;
  private location: string;
  private defaultModel: string;

  constructor(config: { project: string; location: string; model: string }) {
    this.project = config.project;
    this.location = config.location;
    this.defaultModel = config.model;
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      const client = getGeminiVertexClient({
        project: this.project,
        location: this.location,
      });
      const { contents, systemInstruction } = this.convertMessages(options.messages);

      const config: GenerateContentConfig = {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const response = await client.models.generateContent({
        model: this.defaultModel,
        contents,
        config,
      });

      const duration = Date.now() - startTime;

      const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
      const content = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      logger.info('Gemini Provider 生成完成', {
        model: this.defaultModel,
        project: this.project,
        location: this.location,
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
      logger.error('Gemini Provider 生成失败', this.extractErrorMeta(error));
      throw error;
    }
  }

  /**
   * 将标准 AIMessage 转换为 Gemini API 消息格式。
   * system 消息通过 systemInstruction 传递，其余消息按 user/model 角色映射。
   */
  private convertMessages(messages: AIMessage[]): {
    contents: Content[];
    systemInstruction?: string;
  } {
    const systemMessages = messages
      .filter((msg) => msg.role === 'system')
      .map((msg) => msg.content.trim())
      .filter(Boolean);
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const contents = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    if (contents.length === 0) {
      throw new Error('Gemini 请求至少需要一条非 system 消息');
    }

    return {
      contents,
      systemInstruction: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
    };
  }

  private extractErrorMeta(error: unknown): Error | Record<string, unknown> {
    if (error instanceof Error) {
      const meta: Record<string, unknown> = {
        error: error.message,
        project: this.project,
        location: this.location,
        model: this.defaultModel,
      };

      const maybeError = error as Error & {
        status?: number;
        code?: number | string;
      };

      if (maybeError.status !== undefined) {
        meta.status = maybeError.status;
      }
      if (maybeError.code !== undefined) {
        meta.code = maybeError.code;
      }

      return meta;
    }

    return {
      error,
      project: this.project,
      location: this.location,
      model: this.defaultModel,
    };
  }
}
