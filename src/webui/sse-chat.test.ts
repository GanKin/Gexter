import { afterEach, describe, expect, mock, test } from 'bun:test';

import { Agent } from '../agent/agent';
import { createWebRuntimeSession } from './runtime/session';
import { getRuntimeHealth } from './runtime/health';
import { deleteSession, getSession, registerSession } from './runtime/registry';

type RunWebSession = typeof import('./runtime/adapter').runWebSession;

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

    session.status = 'idle';
    return answer;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      session.status = 'idle';
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

const { POST } = await import('../app/api/runtime/sessions/[id]/chat/route');

const trackedSessionIds = new Set<string>();

function createTrackedSession() {
  const session = createWebRuntimeSession();
  registerSession(session);
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

describe('runtime sse chat endpoint', () => {
  test('returns 404 for non-existent session', async () => {
    const response = await POST(makeRequest('test'), {
      params: Promise.resolve({ id: 'web-nonexistent' }),
    });

    expect(response.status).toBe(404);
  });

  test('filters events to STREAMABLE_EVENT_TYPES only', async () => {
    const session = createTrackedSession();

    runWebSessionImpl = async (_session, options) => {
      await options.onEvent?.({
        sessionId: session.id,
        event: { type: 'thinking', message: 'thinking' },
      });
      await options.onEvent?.({
        sessionId: session.id,
        event: {
          type: 'tool_approval',
          requestId: 'req-1',
          tool: 'write_file',
          args: {},
          approved: 'pending',
        },
      });
      await options.onEvent?.({
        sessionId: session.id,
        event: { type: 'tool_limit', tool: 'browser', blocked: false },
      } as never);
      await options.onEvent?.({
        sessionId: session.id,
        event: {
          type: 'tool_start',
          tool: 'browser',
          args: {},
          toolCallId: 'call_1',
        },
      });
      await options.onEvent?.({
        sessionId: session.id,
        event: { type: 'queue_drain', messageCount: 1, mergedText: 'ignored' },
      } as never);
      await options.onEvent?.({
        sessionId: session.id,
        event: {
          type: 'done',
          answer: 'ok',
          toolCalls: [],
          iterations: 1,
          totalTime: 1,
        },
      });
      return 'ok';
    };

    const response = await POST(makeRequest('hello'), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

    const events = parseSseEvents(await response.text());
    const types = events.map((event) => event.type);

    expect(types).toEqual(['thinking', 'tool_approval', 'tool_start', 'done']);
    expect(types).not.toContain('tool_limit');
    expect(types).not.toContain('queue_drain');
    expect(types.every((type) => ['thinking', 'stream_progress', 'tool_start', 'tool_end', 'tool_error', 'tool_approval', 'tool_denied', 'done'].includes(String(type)))).toBe(true);
  });

  test('returns correct SSE headers', async () => {
    const session = createTrackedSession();

    runWebSessionImpl = async (_session, options) => {
      await options.onEvent?.({
        sessionId: session.id,
        event: { type: 'thinking', message: 'thinking' },
      });
      return 'ok';
    };

    const response = await POST(makeRequest('hello'), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('returns 409 when session is already running', async () => {
    const session = createTrackedSession();
    session.status = 'running';

    const response = await POST(makeRequest('hello'), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(409);
    expect(getSession(session.id)).toBe(session);
  });
});
