import type {
  ChatModelAdapter,
  ChatModelRunResult,
  ThreadAssistantMessagePart,
  ThreadMessage,
  ToolCallMessagePart,
} from '@assistant-ui/react';

import type { ApprovalDecision } from '@/agent/types';
import { consumeSSEStream, type SSEEvent } from '@/hooks/use-sse-stream';
import { DEFAULT_MODEL, getApiKey, loadPreferences } from '@/lib/preferences';
import { resolveProvider } from '@/providers';

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type DexterToolStatus = 'running' | 'done' | 'error';

export type DexterToolCallView = {
  id: string;
  tool: string;
  status: DexterToolStatus;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
};

export type DexterApprovalView = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied';
  decision?: ApprovalDecision;
};

export type DexterAssistantMetadata = {
  thinkingMessage?: string | null;
  toolCalls?: DexterToolCallView[];
  approvalRequest?: DexterApprovalView;
};

export type DexterAssistantAdapterOptions = {
  onSessionId?: (sessionId: string) => void;
  onError?: (message: string) => void;
  onRunStateChange?: (isRunning: boolean) => void;
};

export const LEGACY_WEBUI_STORAGE_KEYS = [
  'dexter-sessions',
  'dexter-active-session-id',
  'dexter-session-id',
] as const;

const LEGACY_HISTORY_CLEAR_MARKER = 'dexter-assistant-ui-history-cleared';
const LEGACY_INDEXED_DB_NAME = 'dexter-webui';

export type DexterRunState = {
  text: string;
  thinkingMessage: string | null;
  toolCalls: DexterToolCallView[];
  approvalRequest?: DexterApprovalView;
  done: boolean;
  error?: string;
};

type AsyncQueue<T> = AsyncIterable<T> & {
  push(value: T): void;
  close(): void;
  fail(error: unknown): void;
};

function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: T[] = [];
  const waiters: Array<{
    resolve: (result: IteratorResult<T>) => void;
    reject: (error: unknown) => void;
  }> = [];
  let closed = false;
  let failure: unknown;

  const flush = () => {
    while (waiters.length > 0 && values.length > 0) {
      waiters.shift()!.resolve({ done: false, value: values.shift()! });
    }

    if (failure) {
      while (waiters.length > 0) {
        waiters.shift()!.reject(failure);
      }
      return;
    }

    if (closed) {
      while (waiters.length > 0) {
        waiters.shift()!.resolve({ done: true, value: undefined });
      }
    }
  };

  return {
    push(value) {
      if (closed || failure) {
        return;
      }
      values.push(value);
      flush();
    },
    close() {
      closed = true;
      flush();
    },
    fail(error) {
      failure = error;
      flush();
    },
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (values.length > 0) {
            return Promise.resolve({ done: false, value: values.shift()! });
          }
          if (failure) {
            return Promise.reject(failure);
          }
          if (closed) {
            return Promise.resolve({ done: true, value: undefined });
          }
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            waiters.push({ resolve, reject });
          });
        },
      };
    },
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function deleteIndexedDb(name: string): Promise<void> {
  if (!isBrowser() || typeof indexedDB === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export async function clearLegacyWebUiHistory(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  if (window.localStorage.getItem(LEGACY_HISTORY_CLEAR_MARKER) === 'true') {
    return;
  }

  for (const key of LEGACY_WEBUI_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  await deleteIndexedDb(LEGACY_INDEXED_DB_NAME);
  window.localStorage.setItem(LEGACY_HISTORY_CLEAR_MARKER, 'true');
}

function getMessageText(message: Pick<ThreadMessage, 'content'>): string {
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

export function buildDexterHistoryPayload(messages: readonly ThreadMessage[]): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  let pendingUser: string | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      const text = getMessageText(message);
      pendingUser = text.length > 0 ? text : null;
      continue;
    }

    if (message.role === 'assistant' && pendingUser) {
      const answer = getMessageText(message);
      if (answer.length > 0) {
        history.push({ role: 'user', content: pendingUser });
        history.push({ role: 'assistant', content: answer });
      }
      pendingUser = null;
    }
  }

  return history;
}

export function getLatestUserQuery(messages: readonly ThreadMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return getMessageText(message);
    }
  }

  return '';
}

function stringifyArgs(args: Record<string, unknown> | undefined): string {
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return '{}';
  }
}

function createToolPart(tool: DexterToolCallView): ToolCallMessagePart {
  return {
    type: 'tool-call',
    toolCallId: tool.id,
    toolName: tool.tool,
    args: (tool.args ?? {}) as never,
    argsText: stringifyArgs(tool.args),
    result: tool.result ?? tool.error,
    isError: tool.status === 'error',
  };
}

export function buildAssistantContent(state: DexterRunState): ThreadAssistantMessagePart[] {
  const content: ThreadAssistantMessagePart[] = state.toolCalls.map(createToolPart);
  if (state.text.length > 0) {
    content.push({ type: 'text', text: state.text });
  }
  return content;
}

function findToolIndex(toolCalls: DexterToolCallView[], event: { tool: string; toolCallId?: string }): number {
  if (event.toolCallId) {
    const byId = toolCalls.findIndex((toolCall) => toolCall.id === event.toolCallId);
    if (byId >= 0) {
      return byId;
    }
  }

  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    const toolCall = toolCalls[index];
    if (toolCall?.tool === event.tool && toolCall.status === 'running') {
      return index;
    }
  }

  return -1;
}

function upsertTool(
  toolCalls: DexterToolCallView[],
  event: { tool: string; toolCallId?: string },
  updater: (toolCall: DexterToolCallView) => DexterToolCallView,
): DexterToolCallView[] {
  const index = findToolIndex(toolCalls, event);
  if (index < 0) {
    return toolCalls;
  }

  const next = toolCalls.slice();
  next[index] = updater(next[index]);
  return next;
}

export function applyDexterSseEvent(state: DexterRunState, event: SSEEvent): DexterRunState {
  if (event.type === 'thinking') {
    return { ...state, thinkingMessage: event.message };
  }

  if (event.type === 'stream_progress') {
    const text = event.mode === 'responding' && typeof event.textDelta === 'string'
      ? `${state.text}${event.textDelta}`
      : state.text;
    const thinkingMessage =
      event.mode === 'requesting'
        ? '正在请求模型...'
        : event.mode === 'thinking'
          ? 'Dexter 正在思考...'
          : event.mode === 'tool-input' || event.mode === 'tool-use'
            ? '正在调用工具...'
            : null;

    return { ...state, text, thinkingMessage };
  }

  if (event.type === 'tool_start') {
    return {
      ...state,
      thinkingMessage: null,
      toolCalls: [
        ...state.toolCalls,
        {
          id: event.toolCallId ?? `${event.tool}-${state.toolCalls.length + 1}`,
          tool: event.tool,
          args: event.args,
          status: 'running',
        },
      ],
    };
  }

  if (event.type === 'tool_end') {
    return {
      ...state,
      thinkingMessage: null,
      toolCalls: upsertTool(state.toolCalls, event, (toolCall) => ({
        ...toolCall,
        status: 'done',
        result: event.result,
        duration: event.duration,
      })),
    };
  }

  if (event.type === 'tool_error') {
    return {
      ...state,
      thinkingMessage: null,
      toolCalls: upsertTool(state.toolCalls, event, (toolCall) => ({
        ...toolCall,
        status: 'error',
        error: event.error,
      })),
    };
  }

  if (event.type === 'tool_approval') {
    return {
      ...state,
      thinkingMessage: null,
      approvalRequest: {
        id: event.requestId,
        tool: event.tool,
        args: event.args,
        status:
          event.approved === 'pending'
            ? 'pending'
            : event.approved === 'deny'
              ? 'denied'
              : 'approved',
        decision: event.approved === 'pending' ? undefined : event.approved,
      },
    };
  }

  if (event.type === 'tool_denied') {
    return {
      ...state,
      approvalRequest:
        state.approvalRequest?.id === event.requestId
          ? { ...state.approvalRequest, status: 'denied', decision: 'deny' }
          : state.approvalRequest,
    };
  }

  if (event.type === 'done') {
    const toolCalls = state.toolCalls.length > 0
      ? state.toolCalls
      : event.toolCalls.map((toolCall, index) => ({
        id: `${toolCall.tool}-${index + 1}`,
        tool: toolCall.tool,
        args: toolCall.args,
        result: toolCall.result,
        status: 'done' as const,
      }));

    return {
      ...state,
      text: event.answer,
      thinkingMessage: null,
      toolCalls,
      done: true,
    };
  }

  if (event.type === 'error') {
    return {
      ...state,
      error: event.message,
      thinkingMessage: null,
      done: true,
    };
  }

  return state;
}

function buildMetadata(state: DexterRunState): { custom: DexterAssistantMetadata } {
  return {
    custom: {
      thinkingMessage: state.thinkingMessage,
      toolCalls: state.toolCalls,
      approvalRequest: state.approvalRequest,
    },
  };
}

export function buildRunResult(state: DexterRunState): ChatModelRunResult {
  return {
    content: buildAssistantContent(state),
    status: state.done
      ? state.error
        ? { type: 'incomplete', reason: 'error', error: state.error }
        : { type: 'complete', reason: 'stop' }
      : { type: 'running' },
    metadata: buildMetadata(state),
  };
}

async function fetchRuntimeModel(): Promise<string | null> {
  try {
    const response = await fetch('/api/runtime/health');
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { model?: unknown };
    return typeof body.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : null;
  } catch {
    return null;
  }
}

async function ensureRuntimeSession(
  targetSessionId: string,
  history: HistoryMessage[],
  model: string,
): Promise<void> {
  const provider = resolveProvider(model).id;
  const response = await fetch('/api/runtime/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: targetSessionId,
      model,
      provider,
      apiKey: getApiKey(provider) ?? undefined,
      history,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text() || `Session creation failed: ${response.status}`);
  }
}

async function abortRuntimeSession(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/runtime/sessions/${sessionId}/abort`, { method: 'POST' });
  } catch {
    // The local runtime still receives the browser abort signal; server abort is best-effort.
  }
}

export function createDexterAssistantAdapter(options: DexterAssistantAdapterOptions = {}): ChatModelAdapter {
  let sessionId: string | null = null;

  return {
    async *run(runOptions) {
      const query = getLatestUserQuery(runOptions.messages);
      if (!query) {
        return;
      }

      options.onError?.('');
      options.onRunStateChange?.(true);

      const activeSessionId = sessionId ?? `web-${crypto.randomUUID()}`;
      sessionId = activeSessionId;
      options.onSessionId?.(activeSessionId);

      const priorMessages = runOptions.messages.slice(0, -1);
      const history = buildDexterHistoryPayload(priorMessages);
      const preferredModel = loadPreferences().model || DEFAULT_MODEL;
      const model = (await fetchRuntimeModel()) ?? preferredModel;
      const provider = resolveProvider(model).id;

      const abortListener = () => {
        void abortRuntimeSession(activeSessionId);
      };
      runOptions.abortSignal.addEventListener('abort', abortListener, { once: true });

      let state: DexterRunState = {
        text: '',
        thinkingMessage: '正在连接 Dexter runtime...',
        toolCalls: [],
        done: false,
      };

      try {
        yield buildRunResult(state);
        await ensureRuntimeSession(activeSessionId, history, model);

        const response = await fetch(`/api/runtime/sessions/${activeSessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: runOptions.abortSignal,
          body: JSON.stringify({
            query,
            sessionId: activeSessionId,
            model,
            provider,
            apiKey: getApiKey(provider) ?? undefined,
            history,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text() || `Chat request failed: ${response.status}`);
        }

        const queue = createAsyncQueue<ChatModelRunResult>();
        void consumeSSEStream(response, {
          onEvent: (event) => {
            state = applyDexterSseEvent(state, event);
            queue.push(buildRunResult(state));
          },
          onError: (error) => {
            state = { ...state, error: error.message || 'Streaming failed', done: true };
            queue.push(buildRunResult(state));
            queue.close();
          },
          onComplete: () => {
            if (!state.done) {
              state = { ...state, done: true };
              queue.push(buildRunResult(state));
            }
            queue.close();
          },
        }).catch((error) => queue.fail(error));

        for await (const result of queue) {
          yield result;
        }

        if (state.error) {
          options.onError?.(state.error);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        const message = error instanceof Error ? error.message : 'Unable to send query';
        options.onError?.(message);
        state = { ...state, text: state.text || `Error: ${message}`, error: message, done: true };
        yield buildRunResult(state);
      } finally {
        runOptions.abortSignal.removeEventListener('abort', abortListener);
        options.onRunStateChange?.(false);
      }
    },
  };
}
