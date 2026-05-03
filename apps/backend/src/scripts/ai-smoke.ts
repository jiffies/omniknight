import { env } from '../config/env';
import { generateCompletion } from '../services/ai/client';

async function main() {
  if (!env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('缺少 GOOGLE_CLOUD_PROJECT，无法运行 Vertex AI 烟雾测试');
  }

  const response = await generateCompletion({
    messages: [
      {
        role: 'system',
        content: '你是一个简洁的助手。请用不超过 12 个中文字符回答。',
      },
      {
        role: 'user',
        content: '回复“Vertex 正常”这几个字。',
      },
    ],
    temperature: 0,
    maxTokens: 128,
  });

  const content = response.content.trim();
  if (!content) {
    throw new Error('Vertex AI 烟雾测试失败：模型未返回正文内容');
  }

  console.log(
    JSON.stringify(
      {
        provider: 'gemini',
        project: env.GOOGLE_CLOUD_PROJECT,
        location: env.GOOGLE_CLOUD_LOCATION,
        model: response.model,
        tokensUsed: response.tokensUsed,
        content,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[ai:smoke] 失败');
  console.error(error);
  process.exitCode = 1;
});
