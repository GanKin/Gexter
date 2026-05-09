import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { EmbeddingProviderId, MemoryEmbeddingClient } from './types.js';
import { DEFAULT_MEMORY_EMBEDDING_MODEL, getMemoryEmbeddingConnection } from './env.js';

const DEFAULT_OPENAI_MODEL = 'text-embedding-3-small';
const DEFAULT_GEMINI_MODEL = 'gemini-embedding-001';
const DEFAULT_OLLAMA_MODEL = 'nomic-embed-text';
const EMBEDDING_BATCH_SIZE = 64;
const EMBEDDING_TIMEOUT_MS = 15_000;

type ResolvedProvider = Exclude<EmbeddingProviderId, 'auto' | 'none'>;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function resolveProvider(preferred: EmbeddingProviderId, connection: { baseUrl?: string; apiKey?: string }): ResolvedProvider | null {
  if (preferred === 'openai') {
    return connection.baseUrl && connection.apiKey ? 'openai' : null;
  }
  if (preferred === 'gemini' && process.env.GOOGLE_API_KEY) {
    return 'gemini';
  }
  if (preferred === 'ollama') {
    return 'ollama';
  }

  if (preferred === 'auto') {
    if (connection.baseUrl && connection.apiKey) {
      return 'openai';
    }
    if (process.env.GOOGLE_API_KEY) {
      return 'gemini';
    }
    if (process.env.OLLAMA_BASE_URL) {
      return 'ollama';
    }
  }

  return null;
}

async function embedInBatches(
  texts: string[],
  embedBatch: (batch: string[]) => Promise<number[][]>,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const result = await withTimeout(embedBatch(batch), EMBEDDING_TIMEOUT_MS, 'Embedding API timed out');
    vectors.push(...result);
  }
  return vectors;
}

export function createEmbeddingClient(params: {
  provider: EmbeddingProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}): MemoryEmbeddingClient | null {
  const connection = getMemoryEmbeddingConnection({
    model: params.model,
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
  });
  const resolved = resolveProvider(params.provider, connection);
  if (!resolved) {
    return null;
  }

  if (resolved === 'openai') {
    const model = connection.model || DEFAULT_MEMORY_EMBEDDING_MODEL || DEFAULT_OPENAI_MODEL;
    const embeddings = new OpenAIEmbeddings({
      apiKey: connection.apiKey,
      model,
      configuration: connection.baseUrl ? { baseURL: connection.baseUrl } : undefined,
    });
    return {
      provider: 'openai',
      model,
      embed: async (texts: string[]) =>
        embedInBatches(texts, async (batch) => embeddings.embedDocuments(batch)),
    };
  }

  if (resolved === 'gemini') {
    const model = params.model || DEFAULT_GEMINI_MODEL;
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model,
    });
    return {
      provider: 'gemini',
      model,
      embed: async (texts: string[]) =>
        embedInBatches(texts, async (batch) => embeddings.embedDocuments(batch)),
    };
  }

  const model = params.model || DEFAULT_OLLAMA_MODEL;
  const embeddings = new OllamaEmbeddings({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model,
  });
  return {
    provider: 'ollama',
    model,
    embed: async (texts: string[]) =>
      embedInBatches(texts, async (batch) => embeddings.embedDocuments(batch)),
  };
}

export async function embedSingleQuery(
  client: MemoryEmbeddingClient | null,
  query: string,
): Promise<number[] | null> {
  if (!client) {
    return null;
  }
  const vectors = await withTimeout(client.embed([query]), EMBEDDING_TIMEOUT_MS, 'Embedding query timed out');
  return vectors[0] ?? null;
}
