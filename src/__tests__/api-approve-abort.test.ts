import { afterEach, describe, expect, test } from 'bun:test';

import { createWebRuntimeSession } from '@/webui/runtime/session';
import { deleteSession } from '@/webui/runtime/registry';

const { POST: approvePOST } = await import('@/app/api/runtime/sessions/[id]/approve/route');
const { POST: abortPOST } = await import('@/app/api/runtime/sessions/[id]/abort/route');

const trackedSessionIds = new Set<string>();

function createTrackedSession() {
  const session = createWebRuntimeSession();
  trackedSessionIds.add(session.id);
  return session;
}

function makeApproveRequest(requestId: string, decision: string) {
  return new Request('http://local/api/runtime/sessions/web-test/approve', {
    method: 'POST',
    body: JSON.stringify({ requestId, decision }),
  });
}

function makeAbortRequest() {
  return new Request('http://local/api/runtime/sessions/web-test/abort', {
    method: 'POST',
  });
}

afterEach(() => {
  for (const sessionId of trackedSessionIds) {
    deleteSession(sessionId);
  }
  trackedSessionIds.clear();
});

describe('api runtime approval and abort routes', () => {
  test('accepts a valid approval decision', async () => {
    const session = createTrackedSession();
    let receivedDecision: string | null = null;

    session.pendingApproval = {
      requestId: 'test-req',
      tool: 'browser',
      args: { url: 'https://example.com' },
      resolve: (decision) => {
        receivedDecision = decision;
      },
    };

    const response = await approvePOST(makeApproveRequest('test-req', 'allow-once'), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(String(receivedDecision)).toBe('allow-once');
    expect(session.pendingApproval).toBeNull();
  });

  test('rejects invalid approval decisions', async () => {
    const session = createTrackedSession();
    const pendingApproval = {
      requestId: 'test-req',
      tool: 'browser',
      args: {},
      resolve: () => {},
    };
    session.pendingApproval = pendingApproval;

    const response = await approvePOST(makeApproveRequest('test-req', 'invalid'), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(400);
    expect(session.pendingApproval).toBe(pendingApproval);
  });

  test('aborts a running session', async () => {
    const session = createTrackedSession();
    session.abortController = new AbortController();

    const response = await abortPOST(makeAbortRequest(), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: 'aborted' });
    expect(session.abortController.signal.aborted).toBe(true);
  });

  test('returns 404 when aborting a missing session', async () => {
    const response = await abortPOST(makeAbortRequest(), {
      params: Promise.resolve({ id: 'web-missing' }),
    });

    expect(response.status).toBe(404);
  });
});
