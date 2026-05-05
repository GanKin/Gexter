import { afterEach, describe, expect, test } from 'bun:test';

import { createWebRuntimeSession } from '@/webui/runtime/session';
import { deleteSession } from '@/webui/runtime/registry';

const { POST } = await import('@/app/api/runtime/sessions/route');

const trackedSessionIds = new Set<string>();

function createTrackedSession(sessionId?: string) {
  const session = createWebRuntimeSession({ sessionId });
  trackedSessionIds.add(session.id);
  return session;
}

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://local/api/runtime/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  for (const sessionId of trackedSessionIds) {
    deleteSession(sessionId);
  }
  trackedSessionIds.clear();
});

describe('api runtime sessions route', () => {
  test('creates a session with sessionId and model', async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(typeof body.sessionId).toBe('string');
    expect(String(body.sessionId)).toMatch(/^web-/);
    expect(typeof body.model).toBe('string');
    expect(String(body.model)).toBeTruthy();

    trackedSessionIds.add(String(body.sessionId));
  });

  test('returns unique session IDs across calls', async () => {
    const first = (await (await POST(makeRequest())).json()) as Record<string, unknown>;
    const second = (await (await POST(makeRequest())).json()) as Record<string, unknown>;

    trackedSessionIds.add(String(first.sessionId));
    trackedSessionIds.add(String(second.sessionId));

    expect(first.sessionId).not.toBe(second.sessionId);
  });

  test('keeps session histories isolated', () => {
    const sessionA = createTrackedSession('web-session-a');
    const sessionB = createTrackedSession('web-session-b');

    sessionA.history.saveUserQuery('alpha');
    sessionB.history.saveUserQuery('beta');

    expect(sessionA.history.getMessages()).toHaveLength(1);
    expect(sessionA.history.getMessages()[0]?.query).toBe('alpha');
    expect(sessionB.history.getMessages()).toHaveLength(1);
    expect(sessionB.history.getMessages()[0]?.query).toBe('beta');
    expect(sessionA.history).not.toBe(sessionB.history);
  });
});
