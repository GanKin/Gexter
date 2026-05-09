export const DEFAULT_MEMORY_EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-0.6B';

export type MemoryEmbeddingConnection = {
  model: string;
  baseUrl?: string;
  apiKey?: string;
};

function readEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function getMemoryEmbeddingConnection(overrides: Partial<MemoryEmbeddingConnection> = {}): MemoryEmbeddingConnection {
  return {
    model: overrides.model?.trim() || readEnvValue('MEMORY_EMBEDDING_MODEL') || DEFAULT_MEMORY_EMBEDDING_MODEL,
    baseUrl:
      overrides.baseUrl?.trim() ||
      readEnvValue('MEMORY_EMBEDDING_BASE_URL') ||
      readEnvValue('OPENAI_BASE_URL'),
    apiKey:
      overrides.apiKey?.trim() ||
      readEnvValue('MEMORY_EMBEDDING_API_KEY') ||
      readEnvValue('OPENAI_API_KEY'),
  };
}
