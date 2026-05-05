import { afterEach, describe, expect, mock, test } from 'bun:test';

import { createWebRuntimeSession } from '../runtime/session';
import { deleteSession, registerSession } from '../runtime/registry';
type RunWebSession = typeof import('../runtime/adapter').runWebSession;

let runWebSessionImpl: RunWebSession | null = null;

mock.module('../runtime/adapter', () => ({
  getRuntimeHealth: async () => ({
    ok: true,
    runtime: 'dexter',
    mode: 'webui',
    model: 'gpt-5.4',
    gatewayCompatible: true as const,
  }),
  runWebSession: (...args: Parameters<RunWebSession>) =>
    runWebSessionImpl
      ? runWebSessionImpl(...args)
      : Promise.resolve('ok'),
}));

const { handleWebUiRequest } = await import('./routes');

function createTrackedSession() {
  const session = createWebRuntimeSession();
  registerSession(session);
  return session;
}

describe('webui bun server routes', () => {
  afterEach(() => {
    runWebSessionImpl = null;
  });

  test('routes nested chat requests instead of returning 404', async () => {
    const session = createTrackedSession();
    runWebSessionImpl = async (_session, options) => {
      await options.onEvent?.({
        sessionId: session.id,
        event: {
          type: 'done',
          answer: 'final answer',
          toolCalls: [],
          iterations: 1,
          totalTime: 1,
        },
      });
      return 'final answer';
    };

    const response = await handleWebUiRequest(
      new Request(`http://local/api/runtime/sessions/${session.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ query: '你好' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(await response.text()).toContain('final answer');

    deleteSession(session.id);
  });

  test('recreates a missing session from chat history', async () => {
    const sessionId = `web-${crypto.randomUUID()}`;
    runWebSessionImpl = async (_session, options) => {
      await options.onEvent?.({
        sessionId,
        event: {
          type: 'done',
          answer: 'recovered',
          toolCalls: [],
          iterations: 1,
          totalTime: 1,
        },
      });
      return 'recovered';
    };

    const response = await handleWebUiRequest(
      new Request(`http://local/api/runtime/sessions/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          query: 'hello',
          history: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('recovered');
  });
});
