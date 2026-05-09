import { afterEach, describe, expect, test } from 'bun:test';
import type { ThreadMessage } from '@assistant-ui/react';

import {
  loadThreadMessages,
  resetThreadStoreForTests,
  saveThreadMessages,
} from './thread-store';

function userMessage(id: string, text: string): ThreadMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
    createdAt: new Date(0),
    attachments: [],
    metadata: { custom: {} },
  };
}

function assistantMessage(id: string, text: string): ThreadMessage {
  return {
    id,
    role: 'assistant',
    content: [{ type: 'text', text }],
    createdAt: new Date(0),
    status: { type: 'running' },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
  };
}

afterEach(() => {
  resetThreadStoreForTests();
});

describe('thread-store', () => {
  test('round-trips assistant-ui thread messages and normalizes transient assistant state', async () => {
    await saveThreadMessages('web-thread-1', [
      userMessage('msg-1', 'hello'),
      assistantMessage('msg-2', 'hi'),
    ]);

    const restored = await loadThreadMessages('web-thread-1');

    expect(restored).toHaveLength(2);
    expect(restored[0]).toMatchObject({
      id: 'msg-1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    });
    expect(restored[1]).toMatchObject({
      id: 'msg-2',
      role: 'assistant',
      status: { type: 'incomplete', reason: 'cancelled' },
    });
    expect(restored[0]?.createdAt).toBeInstanceOf(Date);
  });
});
