import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

export function getGeminiVertexClient(config: {
  project: string;
  location: string;
}): GoogleGenAI {
  const cacheKey = `${config.project}:${config.location}`;

  if (!cachedClient || cachedKey !== cacheKey) {
    cachedClient = new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
      apiVersion: 'v1',
    });
    cachedKey = cacheKey;
  }

  return cachedClient;
}
