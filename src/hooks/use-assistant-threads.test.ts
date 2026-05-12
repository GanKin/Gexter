import { describe, expect, test } from 'bun:test';

import { mergeSessionSummaries } from './use-assistant-threads';
import type { SessionSummary } from '@/lib/session-index';

function makeSession(sessionId: string, lastActiveAt: string, title = sessionId): SessionSummary {
  return {
    sessionId,
    title,
    createdAt: '2026-05-12T00:00:00.000Z',
    lastActiveAt,
    model: 'gpt-5.4',
    messageCount: 0,
  };
}

describe('mergeSessionSummaries', () => {
  test('keeps locally created sessions that are missing from the server list', () => {
    const serverSessions = [makeSession('web-old', '2026-05-11T10:00:00.000Z', '旧会话')];
    const localSessions = [
      makeSession('web-new', '2026-05-12T10:00:00.000Z', '新会话'),
      makeSession('web-old', '2026-05-11T09:00:00.000Z', '旧会话（本地）'),
    ];

    const merged = mergeSessionSummaries(serverSessions, localSessions);

    expect(merged.map((session) => session.sessionId)).toEqual(['web-new', 'web-old']);
    expect(merged[0]?.title).toBe('新会话');
    expect(merged[1]?.title).toBe('旧会话');
  });

  test('prefers the server copy when both sources contain the same session', () => {
    const serverSessions = [makeSession('web-1', '2026-05-12T09:00:00.000Z', '服务端标题')];
    const localSessions = [makeSession('web-1', '2026-05-11T09:00:00.000Z', '本地标题')];

    const merged = mergeSessionSummaries(serverSessions, localSessions);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('服务端标题');
    expect(merged[0]?.lastActiveAt).toBe('2026-05-12T09:00:00.000Z');
  });
});
