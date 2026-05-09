import { describe, expect, test } from 'bun:test';
import type { ThreadMessage } from '@assistant-ui/react';

import {
  applyDexterSseEvent,
  buildAssistantContent,
  buildDexterHistoryPayload,
  buildRunResult,
  type DexterRunState,
  getLatestUserQuery,
} from './assistant-adapter';

function message(role: 'user' | 'assistant', text: string): ThreadMessage {
  return {
    id: `${role}-${text}`,
    role,
    content: [{ type: 'text', text }],
    createdAt: new Date(0),
    status: role === 'assistant' ? { type: 'complete', reason: 'stop' } : undefined,
    attachments: role === 'user' ? [] : undefined,
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
  } as ThreadMessage;
}

describe('assistant-ui Dexter adapter mapping', () => {
  test('builds history from complete user and assistant turns only', () => {
    const history = buildDexterHistoryPayload([
      message('user', 'first question'),
      message('assistant', 'first answer'),
      message('user', 'next question'),
    ]);

    expect(history).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
    ]);
  });

  test('extracts the latest user query for the runtime request', () => {
    expect(getLatestUserQuery([
      message('user', 'older'),
      message('assistant', 'answer'),
      message('user', 'latest'),
    ])).toBe('latest');
  });

  test('maps thinking, progress, and done events into assistant content', () => {
    let state: DexterRunState = {
      text: '',
      reasoningText: '',
      thinkingMessage: null,
      toolCalls: [],
      done: false,
    };

    state = applyDexterSseEvent(state, { type: 'thinking', message: 'thinking' });
    expect(state.thinkingMessage).toBe('thinking');

    state = applyDexterSseEvent(state, {
      type: 'stream_progress',
      mode: 'thinking',
      charDelta: 7,
      thinkingDelta: '先分析',
    });
    expect(state.reasoningText).toBe('先分析');
    expect(buildRunResult(state).metadata?.custom?.reasoningText).toBe('先分析');

    state = applyDexterSseEvent(state, {
      type: 'stream_progress',
      mode: 'responding',
      charDelta: 5,
      textDelta: 'Hello',
    });
    expect(buildAssistantContent(state)).toEqual([{ type: 'text', text: 'Hello' }]);

    state = applyDexterSseEvent(state, {
      type: 'done',
      answer: 'Hello world',
      toolCalls: [],
      iterations: 1,
      totalTime: 1,
    });

    expect(buildRunResult(state).status).toEqual({ type: 'complete', reason: 'stop' });
    expect(buildAssistantContent(state)).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  test('maps tool lifecycle events into assistant-ui tool call parts', () => {
    let state: DexterRunState = {
      text: '',
      reasoningText: '',
      thinkingMessage: null,
      toolCalls: [],
      done: false,
    };

    state = applyDexterSseEvent(state, {
      type: 'tool_start',
      tool: 'financial_search',
      args: { ticker: 'AAPL' },
      toolCallId: 'call-1',
    });
    state = applyDexterSseEvent(state, {
      type: 'tool_end',
      tool: 'financial_search',
      args: { ticker: 'AAPL' },
      result: 'Apple result',
      duration: 42,
      toolCallId: 'call-1',
    });

    expect(buildAssistantContent(state)[0]).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'financial_search',
      args: { ticker: 'AAPL' },
      result: 'Apple result',
      isError: false,
    });
  });

  test('maps approval and error events into metadata/status', () => {
    let state: DexterRunState = {
      text: '',
      reasoningText: '',
      thinkingMessage: null,
      toolCalls: [],
      done: false,
    };

    state = applyDexterSseEvent(state, {
      type: 'tool_approval',
      requestId: 'approval-1',
      tool: 'write_file',
      args: { path: 'x' },
      approved: 'pending',
    });
    expect(buildRunResult(state).metadata?.custom?.approvalRequest).toMatchObject({
      id: 'approval-1',
      status: 'pending',
    });

    state = applyDexterSseEvent(state, { type: 'error', message: 'boom' });
    expect(buildRunResult(state).status).toEqual({ type: 'incomplete', reason: 'error', error: 'boom' });
  });
});
