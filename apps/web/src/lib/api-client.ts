import { hc } from 'hono/client';
import type { AppType } from '../../../backend/src/routes/index';

// 创建强类型 API 客户端
const baseUrl = import.meta.env.DEV
  ? 'http://localhost:3000' // 开发环境
  : ''; // 生产环境使用相对路径

export const apiClient = hc<AppType>(baseUrl);

// 辅助函数：处理 API 响应
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}
