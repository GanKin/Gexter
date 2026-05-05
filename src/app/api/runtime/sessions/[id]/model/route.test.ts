import { afterEach, describe, expect, test } from 'bun:test';

import { deleteSession } from '@/webui/runtime/registry';
import { createWebRuntimeSession } from '@/webui/runtime/session';

const { PATCH } = await import('./route');

const trackedSessionIds = new Set<string>();

afterEach(() => {
  for (const sessionId of trackedSessionIds) {
    deleteSession(sessionId);
  }
  trackedSessionIds.clear();
});

describe('runtime model endpoint', () => {
  test('accepts custom ollama model ids', async () => {
    const session = createWebRuntimeSession({
      sessionId: 'web-model-route-test',
      model: 'ollama:llama3.1',
      modelProvider: 'ollama',
    });
    trackedSessionIds.add(session.id);

    const response = await PATCH(
      new Request('http://local/api/runtime/sessions/web-model-route-test/model', {
        method: 'PATCH',
        body: JSON.stringify({
          model: 'ollama:qwen2.5',
          provider: 'ollama',
          baseUrl: 'http://127.0.0.1:11434',
        }),
      }),
      {
        params: Promise.resolve({ id: session.id }),
      },
    );

    expect(response.status).toBe(200);
    expect(session.model).toBe('ollama:qwen2.5');
    expect(session.modelProvider).toBe('ollama');
    expect(session.baseUrl).toBe('http://127.0.0.1:11434');
  });

  test('accepts custom openai-compatible local model ids', async () => {
    const session = createWebRuntimeSession({
      sessionId: 'web-model-route-local-test',
      model: 'local:llama3.1',
      modelProvider: 'local',
    });
    trackedSessionIds.add(session.id);

    const response = await PATCH(
      new Request('http://local/api/runtime/sessions/web-model-route-local-test/model', {
        method: 'PATCH',
        body: JSON.stringify({
          model: 'local:lmstudio-community/qwen2.5',
          provider: 'local',
          baseUrl: 'http://127.0.0.1:1234/v1',
        }),
      }),
      {
        params: Promise.resolve({ id: session.id }),
      },
    );

    expect(response.status).toBe(200);
    expect(session.model).toBe('local:lmstudio-community/qwen2.5');
    expect(session.modelProvider).toBe('local');
    expect(session.baseUrl).toBe('http://127.0.0.1:1234/v1');
  });

  test('still rejects invalid models for fixed providers', async () => {
    const session = createWebRuntimeSession({
      sessionId: 'web-model-route-invalid',
      model: 'gpt-5.4',
      modelProvider: 'openai',
    });
    trackedSessionIds.add(session.id);

    const response = await PATCH(
      new Request('http://local/api/runtime/sessions/web-model-route-invalid/model', {
        method: 'PATCH',
        body: JSON.stringify({
          model: 'not-a-real-model',
          provider: 'openai',
        }),
      }),
      {
        params: Promise.resolve({ id: session.id }),
      },
    );

    expect(response.status).toBe(400);
  });
});
