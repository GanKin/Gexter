import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  DEFAULT_MEMORY_EMBEDDING_MODEL,
  getMemoryEmbeddingConnection,
} from './env';

const ENV_KEYS = [
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'MEMORY_EMBEDDING_MODEL',
  'MEMORY_EMBEDDING_BASE_URL',
  'MEMORY_EMBEDDING_API_KEY',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const snapshot = new Map<EnvKey, string | undefined>();

function saveSnapshot(): void {
  snapshot.clear();
  for (const key of ENV_KEYS) {
    snapshot.set(key, process.env[key]);
  }
}

function restoreSnapshot(): void {
  for (const key of ENV_KEYS) {
    const value = snapshot.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setEnv(values: Partial<Record<EnvKey, string>>): void {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

describe('memory embedding env config', () => {
  beforeEach(() => {
    saveSnapshot();
  });

  afterEach(() => {
    restoreSnapshot();
  });

  test('defaults to Qwen embeddings and reuses the shared OpenAI env values', () => {
    setEnv({
      OPENAI_BASE_URL: 'https://text.example/v1',
      OPENAI_API_KEY: 'text-key',
    });

    const config = getMemoryEmbeddingConnection();

    expect(config.model).toBe(DEFAULT_MEMORY_EMBEDDING_MODEL);
    expect(config.baseUrl).toBe('https://text.example/v1');
    expect(config.apiKey).toBe('text-key');
  });

  test('prefers memory-specific env overrides when present', () => {
    setEnv({
      OPENAI_BASE_URL: 'https://text.example/v1',
      OPENAI_API_KEY: 'text-key',
      MEMORY_EMBEDDING_MODEL: 'Qwen/Qwen3-Embedding-0.6B',
      MEMORY_EMBEDDING_BASE_URL: 'https://memory.example/v1',
      MEMORY_EMBEDDING_API_KEY: 'memory-key',
    });

    const config = getMemoryEmbeddingConnection();

    expect(config.model).toBe('Qwen/Qwen3-Embedding-0.6B');
    expect(config.baseUrl).toBe('https://memory.example/v1');
    expect(config.apiKey).toBe('memory-key');
  });

  test('falls back to the built-in embedding model when no env is configured', () => {
    setEnv({});

    const config = getMemoryEmbeddingConnection();

    expect(config.model).toBe(DEFAULT_MEMORY_EMBEDDING_MODEL);
    expect(config.baseUrl).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
  });
});
