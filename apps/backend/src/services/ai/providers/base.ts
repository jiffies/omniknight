/**
 * AI Provider 基础接口
 * 所有 AI Provider 必须实现此接口
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

export interface AIProvider {
  name: string;
  generate(options: GenerateOptions): Promise<GenerateResponse>;
}
