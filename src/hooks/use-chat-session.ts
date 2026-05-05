'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  ApprovalDecision,
  DoneEvent,
  StreamProgressEvent,
  ThinkingEvent,
  ToolApprovalEvent,
  ToolDeniedEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from '@/agent/types';
import { resolveProvider } from '@/providers';
import { DEFAULT_MODEL, getApiKey, savePreference } from '@/lib/preferences';
import {
  addToIndex,
  getActiveSessionId,
  getSessionIndex,
  removeFromIndex,
  setActiveSessionId,
  updateIndex,
  type SessionSummary,
} from '@/lib/session-index';
import {
  buildSessionMetadata,
  deleteSession as deleteStoredSession,
  loadMessages,
  saveMessages,
  saveSession,
} from '@/lib/session-store';
import { consumeSSEStream, type ChatMessage, type SSEEvent, type ToolCallInfo } from '@/hooks/use-sse-stream';

function createEmptyAssistantMessage(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    status: 'streaming',
    toolCalls: [],
    thinking: true,
    thinkingMessage: '正在连接 Dexter runtime...',
  };
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    status: 'complete',
    toolCalls: [],
    thinking: false,
    thinkingMessage: null,
  };
}

function replaceAssistantMessage(
  messages: ChatMessage[],
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'assistant') {
      const next = messages.slice();
      next[index] = updater(next[index]);
      return next;
    }
  }

  return messages;
}

function updateLatestToolCall(
  toolCalls: ToolCallInfo[],
  tool: string,
  updater: (toolCall: ToolCallInfo) => ToolCallInfo,
): ToolCallInfo[] {
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    if (toolCalls[index]?.tool === tool && toolCalls[index]?.status === 'running') {
      const next = toolCalls.slice();
      next[index] = updater(next[index]);
      return next;
    }
  }

  return toolCalls;
}

function isToolApprovalEvent(event: SSEEvent): event is ToolApprovalEvent {
  return event.type === 'tool_approval';
}

function isToolDeniedEvent(event: SSEEvent): event is ToolDeniedEvent {
  return event.type === 'tool_denied';
}

function mapToolCalls(toolCalls: DoneEvent['toolCalls']): ToolCallInfo[] {
  return toolCalls.map((call) => ({
    tool: call.tool,
    status: 'done',
    args: call.args,
    result: call.result,
  }));
}

function isStreamProgressEvent(event: SSEEvent): event is StreamProgressEvent {
  return event.type === 'stream_progress';
}

function isThinkingEvent(event: SSEEvent): event is ThinkingEvent {
  return event.type === 'thinking';
}

function isToolStartEvent(event: SSEEvent): event is ToolStartEvent {
  return event.type === 'tool_start';
}

function isToolEndEvent(event: SSEEvent): event is ToolEndEvent {
  return event.type === 'tool_end';
}

function isToolErrorEvent(event: SSEEvent): event is ToolErrorEvent {
  return event.type === 'tool_error';
}

function isDoneEvent(event: SSEEvent): event is DoneEvent {
  return event.type === 'done';
}

function buildHistoryPayload(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let pendingUser: ChatMessage | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      pendingUser = message;
      continue;
    }

    if (message.role === 'assistant' && pendingUser) {
      history.push({ role: 'user', content: pendingUser.content });
      history.push({ role: 'assistant', content: message.content });
      pendingUser = null;
    }
  }

  return history;
}

function createInitialCurrentModel(): string {
  return DEFAULT_MODEL;
}

function createInitialSessionId(): string | null {
  return getActiveSessionId();
}

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => createInitialSessionId());
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(() => createInitialCurrentModel());
  const sessionIdRef = useRef<string | null>(sessionId);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const streamingRef = useRef(false);
  const currentModelRef = useRef(currentModel);
  const runtimeDefaultModelRef = useRef<string | null>(null);
  const modelOverrideRef = useRef(false);
  const sessionListRef = useRef<SessionSummary[]>([]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    streamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  useEffect(() => {
    sessionListRef.current = sessionList;
  }, [sessionList]);

  const mutateMessages = (updater: (current: ChatMessage[]) => ChatMessage[]) => {
    setMessages((current) => {
      const next = updater(current);
      messagesRef.current = next;
      return next;
    });
  };

  const loadSessionList = async (): Promise<SessionSummary[]> => {
    const list = getSessionIndex();
    setSessionList(list);
    sessionListRef.current = list;
    return list;
  };

  const fetchRuntimeDefaultModel = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/runtime/health');
      if (!response.ok) {
        return runtimeDefaultModelRef.current;
      }

      const data = (await response.json()) as { model?: unknown };
      if (typeof data.model === 'string' && data.model.length > 0) {
        runtimeDefaultModelRef.current = data.model;
        return data.model;
      }
    } catch {
      // Keep the last known runtime default if the status endpoint is unavailable.
    }

    return runtimeDefaultModelRef.current;
  };

  useEffect(() => {
    const loadPreferencesAndHealth = async () => {
      const model = await fetchRuntimeDefaultModel();
      if (model && !modelOverrideRef.current && currentModelRef.current === DEFAULT_MODEL) {
        setCurrentModel(model);
      }
    };

    void loadPreferencesAndHealth();
  }, []);

  const persistSessionSnapshot = async (
    targetSessionId: string,
    snapshotMessages: ChatMessage[],
    model = currentModelRef.current,
  ): Promise<void> => {
    const existing = sessionListRef.current.find((entry) => entry.sessionId === targetSessionId) ?? null;
    const metadata = buildSessionMetadata(targetSessionId, snapshotMessages, model, existing);
    await Promise.all([
      saveMessages(targetSessionId, snapshotMessages),
      saveSession(targetSessionId, metadata),
    ]);

    addToIndex(targetSessionId, metadata.title, metadata.model);
    updateIndex(targetSessionId, {
      title: metadata.title,
      createdAt: metadata.createdAt,
      lastActiveAt: metadata.lastActiveAt,
      model: metadata.model,
      messageCount: metadata.messageCount,
    });

    setActiveSessionId(targetSessionId);
    await loadSessionList();
  };

  const ensureRuntimeSession = async (
    targetSessionId: string,
    historyMessages: ChatMessage[] = messagesRef.current,
    model = currentModelRef.current,
  ): Promise<void> => {
    const provider = resolveProvider(model).id;
    const apiKey = getApiKey(provider) ?? undefined;

    const response = await fetch('/api/runtime/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: targetSessionId,
        model,
        provider,
        apiKey,
        history: buildHistoryPayload(historyMessages),
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text() || `Session creation failed: ${response.status}`);
    }
  };

  const createNewSession = async (): Promise<string> => {
    const targetSessionId = `web-${crypto.randomUUID()}`;
    const nextMessages: ChatMessage[] = [];
    const model = (await fetchRuntimeDefaultModel()) ?? currentModelRef.current;

    setError(null);
    modelOverrideRef.current = false;
    currentModelRef.current = model;
    setCurrentModel(model);
    setSessionId(targetSessionId);
    sessionIdRef.current = targetSessionId;
    mutateMessages(() => nextMessages);
    setActiveSessionId(targetSessionId);
    addToIndex(targetSessionId, '新会话', model);
    updateIndex(targetSessionId, {
      title: '新会话',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      model,
      messageCount: 0,
    });
    await saveSession(
      targetSessionId,
      buildSessionMetadata(targetSessionId, nextMessages, model),
    );
    await ensureRuntimeSession(targetSessionId, nextMessages, model);
    await loadSessionList();
    return targetSessionId;
  };

  const ensureSessionId = async (): Promise<string> => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    return createNewSession();
  };

  const createSession = async (): Promise<void> => {
    await createNewSession();
  };

  const switchSession = async (targetSessionId: string): Promise<void> => {
    if (!targetSessionId || targetSessionId === sessionIdRef.current || streamingRef.current) {
      return;
    }

    setError(null);
    if (sessionIdRef.current) {
      await persistSessionSnapshot(sessionIdRef.current, messagesRef.current, currentModelRef.current);
    }

    const targetSummary = sessionListRef.current.find((entry) => entry.sessionId === targetSessionId) ?? null;
    const restoredMessages = await loadMessages(targetSessionId);

    setSessionId(targetSessionId);
    sessionIdRef.current = targetSessionId;
    mutateMessages(() => restoredMessages);
    setActiveSessionId(targetSessionId);

    if (targetSummary?.model && targetSummary.model !== currentModelRef.current) {
      modelOverrideRef.current = true;
      setCurrentModel(targetSummary.model);
      currentModelRef.current = targetSummary.model;
      savePreference('model', targetSummary.model);
      savePreference('provider', resolveProvider(targetSummary.model).id);
    }

    await ensureRuntimeSession(targetSessionId, restoredMessages, targetSummary?.model ?? currentModelRef.current);
    await loadSessionList();
  };

  const startNewSession = async (): Promise<void> => {
    if (streamingRef.current) {
      return;
    }

    if (sessionIdRef.current) {
      await persistSessionSnapshot(sessionIdRef.current, messagesRef.current, currentModelRef.current);
    }

    await createNewSession();
  };

  const deleteSessionById = async (targetSessionId: string): Promise<void> => {
    if (!targetSessionId) {
      return;
    }

    if (streamingRef.current && sessionIdRef.current === targetSessionId) {
      return;
    }

    await deleteStoredSession(targetSessionId);
    removeFromIndex(targetSessionId);

    if (sessionIdRef.current === targetSessionId) {
      setSessionId(null);
      sessionIdRef.current = null;
      mutateMessages(() => []);
      await createNewSession();
      return;
    }

    await loadSessionList();
  };

  useEffect(() => {
    const initialize = async () => {
      const list = await loadSessionList();
      const activeSessionId = getActiveSessionId();

      if (!activeSessionId) {
        return;
      }

      const restoredMessages = await loadMessages(activeSessionId);
      const summary = list.find((entry) => entry.sessionId === activeSessionId) ?? null;

      setSessionId(activeSessionId);
      sessionIdRef.current = activeSessionId;
      mutateMessages(() => restoredMessages);

      if (summary?.model && summary.model !== currentModelRef.current) {
        modelOverrideRef.current = true;
        setCurrentModel(summary.model);
        currentModelRef.current = summary.model;
      }

      await ensureRuntimeSession(activeSessionId, restoredMessages, summary?.model ?? currentModelRef.current);
    };

    void initialize();
  }, []);

  useEffect(() => {
    if (!sessionIdRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistSessionSnapshot(sessionIdRef.current!, messagesRef.current, currentModelRef.current);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [messages, currentModel]);

  const changeModel = async (model: string, provider: string): Promise<void> => {
    modelOverrideRef.current = true;
    currentModelRef.current = model;
    setCurrentModel(model);
    savePreference('model', model);
    savePreference('provider', provider);

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      return;
    }

    try {
      await fetch(`/api/runtime/sessions/${currentSessionId}/model`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, provider }),
      });
    } catch {
      // Keep the optimistic local model selection even if the PATCH fails.
    }
  };

  const approveTool = async (
    sessionIdValue: string,
    requestId: string,
    decision: ApprovalDecision,
  ): Promise<void> => {
    if (!sessionIdValue) {
      return;
    }

    try {
      await fetch(`/api/runtime/sessions/${sessionIdValue}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, decision }),
      });
    } catch {
      // Approval is best-effort; the pending card will stay visible if the request fails.
    }
  };

  const abortSession = async (): Promise<void> => {
    if (!sessionIdRef.current || !streamingRef.current) {
      return;
    }

    try {
      await fetch(`/api/runtime/sessions/${sessionIdRef.current}/abort`, { method: 'POST' });
    } catch {
      // Abort is best-effort. The stream will settle even if the request fails.
    }
  };

  const handleEvent = (event: SSEEvent) => {
    if (isThinkingEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: true,
          thinkingMessage: event.message,
        })),
      );
      return;
    }

    if (isStreamProgressEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          content:
            event.mode === 'responding' && typeof event.textDelta === 'string'
              ? `${message.content}${event.textDelta}`
              : message.content,
          thinking: event.mode !== 'responding',
          thinkingMessage:
            event.mode === 'requesting'
              ? '正在请求模型...'
              : event.mode === 'thinking'
                ? 'Dexter 正在思考...'
                : event.mode === 'tool-input' || event.mode === 'tool-use'
                  ? '正在调用工具...'
                  : null,
        })),
      );
      return;
    }

    if (isToolStartEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: false,
          thinkingMessage: null,
          toolCalls: [
            ...message.toolCalls,
            {
              tool: event.tool,
              status: 'running',
              args: event.args,
              startTime: Date.now(),
            },
          ],
        })),
      );
      return;
    }

    if (isToolEndEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: false,
          thinkingMessage: null,
          toolCalls: updateLatestToolCall(message.toolCalls, event.tool, (toolCall) => ({
            ...toolCall,
            status: 'done',
            result: event.result,
            duration:
              typeof event.duration === 'number'
                ? event.duration
                : toolCall.startTime
                  ? Date.now() - toolCall.startTime
                  : undefined,
          })),
        })),
      );
      return;
    }

    if (isToolErrorEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: false,
          thinkingMessage: null,
          toolCalls: updateLatestToolCall(message.toolCalls, event.tool, (toolCall) => ({
            ...toolCall,
            status: 'error',
            error: event.error,
            duration: toolCall.startTime ? Date.now() - toolCall.startTime : undefined,
          })),
        })),
      );
      return;
    }

    if (isToolApprovalEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
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
          thinking: false,
          thinkingMessage: null,
        })),
      );
      return;
    }

    if (isToolDeniedEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => {
          if (message.approvalRequest?.id !== event.requestId) {
            return message;
          }

          return {
            ...message,
            approvalRequest: {
              ...message.approvalRequest,
              status: 'denied',
              decision: 'deny',
            },
          };
        }),
      );
      return;
    }

    if (isDoneEvent(event)) {
      mutateMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          content: event.answer,
          status: 'complete',
          thinking: false,
          thinkingMessage: null,
          toolCalls: message.toolCalls.length > 0 ? message.toolCalls : mapToolCalls(event.toolCalls),
        })),
      );
      setIsStreaming(false);
      return;
    }

    if (event.type === 'error') {
      const message = typeof event.message === 'string' ? event.message : 'Dexter runtime returned an error';
      setError(message);
      mutateMessages((current) =>
        replaceAssistantMessage(current, (assistant) => ({
          ...assistant,
          content: assistant.content || message,
          status: 'complete',
          thinking: false,
          thinkingMessage: null,
        })),
      );
      setIsStreaming(false);
    }
  };

  const sendQuery = async (query: string): Promise<void> => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || streamingRef.current) {
      return;
    }

    setError(null);

    const activeSessionId = await ensureSessionId();
    if (!activeSessionId) {
      setError('Unable to create a Dexter session.');
      return;
    }

    const currentHistory = messagesRef.current;
    const nextMessages = [...currentHistory, createUserMessage(normalizedQuery), createEmptyAssistantMessage()];
    mutateMessages(() => nextMessages);
    setIsStreaming(true);
    streamingRef.current = true;

    try {
      await ensureRuntimeSession(activeSessionId, currentHistory, currentModelRef.current);

      await persistSessionSnapshot(activeSessionId, nextMessages, currentModelRef.current);

      const response = await fetch(`/api/runtime/sessions/${activeSessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: normalizedQuery,
          sessionId: activeSessionId,
          model: currentModelRef.current,
          provider: resolveProvider(currentModelRef.current).id,
          apiKey: getApiKey(resolveProvider(currentModelRef.current).id) ?? undefined,
          history: buildHistoryPayload(currentHistory),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text() || `Chat request failed: ${response.status}`);
      }

      await consumeSSEStream(response, {
        onEvent: handleEvent,
        onError: (streamError) => {
          const message = streamError.message || 'Streaming failed';
          setError(message);
          mutateMessages((current) =>
            replaceAssistantMessage(current, (assistant) => ({
              ...assistant,
              content: assistant.content || `Error: ${message}`,
              status: 'complete',
              thinking: false,
              thinkingMessage: null,
            })),
          );
          streamingRef.current = false;
          setIsStreaming(false);
        },
        onComplete: () => {
          streamingRef.current = false;
          setIsStreaming(false);
          mutateMessages((current) =>
            replaceAssistantMessage(current, (assistant) => ({
              ...assistant,
              status: assistant.status === 'complete' ? assistant.status : 'aborted',
              thinking: false,
              thinkingMessage: null,
            })),
          );
          void persistSessionSnapshot(activeSessionId, messagesRef.current, currentModelRef.current);
        },
      });
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : 'Unable to send query';
      setError(message);
      mutateMessages((current) =>
        replaceAssistantMessage(current, (assistant) => ({
          ...assistant,
          content: assistant.content || `Error: ${message}`,
          status: 'complete',
          thinking: false,
          thinkingMessage: null,
        })),
      );
      streamingRef.current = false;
      setIsStreaming(false);
    }
  };

  return {
    messages,
    isStreaming,
    sessionId,
    sessionList,
    currentModel,
    changeModel,
    sendQuery,
    createSession,
    loadSessionList,
    switchSession,
    startNewSession,
    deleteSessionById,
    approveTool,
    abortSession,
    error,
  };
}
