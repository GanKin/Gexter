import { afterEach, describe, expect, mock, test } from 'bun:test';

import { Agent } from '@/agent/agent';
import { createWebRuntimeSession } from '@/webui/runtime/session';
import { getRuntimeHealth } from '@/webui/runtime/health';
import { deleteSession } from '@/webui/runtime/registry';

type RunWebSession = typeof import('@/webui/runtime/adapter').runWebSession;

let runWebSessionImpl: RunWebSession | null = null;

async function runWebSessionFallback(...args: Parameters<RunWebSession>): Promise<string> {
  const [session, options] = args;
  session.status = 'running';
  const abortController = new AbortController();
  session.abortController = abortController;
  const emitEvent = options.onEvent;

  try {
    const agent = await Agent.create({
      maxIterations: 10,
      ...options.config,
      sessionApprovedTools: session.approvedTools,
      signal: abortController.signal,
      requestToolApproval: async (request) => {
        const { requestId } = request;
        await emitEvent?.({
          sessionId: session.id,
          event: {
            type: 'tool_approval',
            requestId,
            tool: request.tool,
            args: request.args,
            approved: 'pending',
          },
        });

        return new Promise((resolve, reject) => {
          const abortListener = () => {
            session.pendingApproval = null;
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          };

          if (abortController.signal.aborted) {
            abortListener();
            return;
          }

          abortController.signal.addEventListener('abort', abortListener, { once: true });

          session.pendingApproval = {
            resolve: (decision) => {
              abortController.signal.removeEventListener('abort', abortListener);
              resolve(decision);
            },
            requestId,
            tool: request.tool,
            args: request.args,
          };
        });
      },
    });

    let answer = '';
    for await (const event of agent.run(options.query, session.history)) {
      await options.onEvent?.({ sessionId: session.id, event });
      if (event.type === 'done') {
        answer = event.answer;
      }
    }

    session.status = 'complete';
    return answer;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      session.status = 'aborted';
      return '';
    }
    session.status = 'error';
    throw error;
  } finally {
    session.pendingApproval = null;
    session.abortController = undefined;
  }
}

mock.module('@/webui/runtime/adapter', () => ({
  getRuntimeHealth,
  runWebSession: (...args: Parameters<RunWebSession>) =>
    runWebSessionImpl ? runWebSessionImpl(...args) : runWebSessionFallback(...args),
}));

const { POST } = await import('@/app/api/runtime/sessions/[id]/chat/route');

const trackedSessionIds = new Set<string>();

function createTrackedSession() {
  const session = createWebRuntimeSession();
  trackedSessionIds.add(session.id);
  return session;
}

function makeRequest(query: string) {
  return new Request('http://local/api/runtime/sessions/web-test/chat', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

function parseSseEvents(text: string): Array<Record<string, unknown>> {
  return text
    .trim()
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => chunk.replace(/^data: /, ''))
    .map((chunk) => JSON.parse(chunk) as Record<string, unknown>);
}

afterEach(() => {
  for (const sessionId of trackedSessionIds) {
    deleteSession(sessionId);
  }
  trackedSessionIds.clear();
  runWebSessionImpl = null;
});

describe('api runtime session chat stream route', () => {
  test('returns an SSE stream with streamable events', async () => {
    const session = createTrackedSession();

    runWebSessionImpl = async (_session, options) => {
      await options.onEvent?.({
        sessionId: session.id,
        event: { type: 'thinking', message: 'thinking' },
      });
      await options.onEvent?.({
        sessionId: session.id,
        event: {
          type: 'stream_progress',
          charDelta: 7,
          mode: 'responding',
          textDelta: 'hello',
        },
      });
      await options.onEvent?.({
        sessionId: session.id,
        event: {
          type: 'done',
          answer: 'hello',
          toolCalls: [],
          iterations: 1,
          totalTime: 1,
        },
      });
      return 'hello';
    };

    const response = await POST(makeRequest('test'), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');

    const events = parseSseEvents(await response.text());
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(events.every((event) => typeof event.type === 'string')).toBe(true);
  });

  test('serializes SSE event payloads as valid JSON objects', async () => {
    const session = createTrackedSession();

    runWebSessionImpl = async (_session, options) => {
      await options.onEvent?.({
        sessionId: session.id,
        event: { type: 'thinking', message: 'thinking' },
      });
      return 'done';
    };

    const response = await POST(makeRequest('json check'), {
      params: Promise.resolve({ id: session.id }),
    });

    const raw = await response.text();
    expect(raw).toContain('data: ');

    const events = parseSseEvents(raw);
    for (const event of events) {
      expect(typeof event.type).toBe('string');
    }
  });

  test('returns 404 for missing session ids', async () => {
    const response = await POST(makeRequest('test'), {
      params: Promise.resolve({ id: 'web-missing' }),
    });

    expect(response.status).toBe(404);
  });
});
