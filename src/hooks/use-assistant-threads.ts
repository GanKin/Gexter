'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppendMessage,
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadUserMessagePart,
} from '@assistant-ui/react';
import type { ExternalStoreAdapter } from '@assistant-ui/react';

import type { ApprovalDecision } from '@/agent/types';
import {
  addToIndex,
  buildSessionTitle,
  getActiveSessionId,
  getSessionIndex,
  removeFromIndex,
  setActiveSessionId,
  updateIndex,
  type SessionSummary,
} from '@/lib/session-index';
import { deleteThreadMessages, loadThreadMessages, saveThreadMessages } from '@/webui/client/thread-store';
import { DEFAULT_MODEL, getApiKey, loadPreferences } from '@/lib/preferences';
import { resolveProvider } from '@/providers';
import { consumeSSEStream } from '@/hooks/use-sse-stream';
import {
  applyDexterSseEvent,
  buildDexterHistoryPayload,
  buildRunResult,
  getLatestUserQuery,
  type DexterRunState,
} from '@/webui/client/assistant-adapter';
import {
  deleteAccountSession,
  fetchAccountSessionSummaries,
  importLocalAccountHistory,
  loadAccountSession,
  saveAccountSessionSnapshot,
} from '@/webui/client/account-api';

type RuntimeStatusSetter = (isRunning: boolean) => void;

const LOCAL_IMPORT_MARKER = 'dexter-cloud-history-imported';

function mergeSessionSummaries(
  primarySessions: readonly SessionSummary[],
  fallbackSessions: readonly SessionSummary[],
): SessionSummary[] {
  const merged = new Map<string, SessionSummary>();

  for (const session of fallbackSessions) {
    merged.set(session.sessionId, session);
  }

  for (const session of primarySessions) {
    merged.set(session.sessionId, session);
  }

  return [...merged.values()].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

function createMessageId(): string {
  return `msg-${crypto.randomUUID()}`;
}

function createSessionId(): string {
  return `web-${crypto.randomUUID()}`;
}

function createEmptyMetadata(): ThreadMessage['metadata'] {
  return {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {},
  };
}

function mergeMetadata(metadata: { custom?: Record<string, unknown> } | undefined): ThreadMessage['metadata'] {
  return {
    ...createEmptyMetadata(),
    ...metadata,
    custom: metadata?.custom ?? {},
  } as ThreadMessage['metadata'];
}

function createUserMessage(message: AppendMessage): ThreadMessage {
  return {
    id: createMessageId(),
    role: 'user',
    content: message.content as readonly ThreadUserMessagePart[],
    createdAt: new Date(),
    attachments: message.attachments ?? [],
    metadata: mergeMetadata(message.metadata),
  } as ThreadMessage;
}

function createAssistantMessage(state: DexterRunState): ThreadMessage {
  const result = buildRunResult(state);

  return {
    id: createMessageId(),
    role: 'assistant',
    content: result.content as readonly ThreadAssistantMessagePart[],
    createdAt: new Date(),
    status: result.status ?? { type: 'running' },
    metadata: mergeMetadata(result.metadata),
  } as ThreadMessage;
}

function replaceMessage(messages: readonly ThreadMessage[], messageId: string, nextMessage: ThreadMessage): ThreadMessage[] {
  return messages.map((message) => (message.id === messageId ? nextMessage : message));
}

function getThreadTitle(messages: readonly ThreadMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) {
    return '新会话';
  }

  const text = firstUserMessage.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim();

  return buildSessionTitle(text);
}

function formatNewThreadTitle(createdAtIso: string): string {
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(createdAtIso));

  return `新会话 · ${time}`;
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
  messages: readonly ThreadMessage[],
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
      history: buildDexterHistoryPayload(messages),
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
    // The browser abort signal will settle the local stream even if the server abort is best-effort.
  }
}

async function loadServerSessions(): Promise<SessionSummary[]> {
  try {
    return await fetchAccountSessionSummaries();
  } catch {
    return [];
  }
}

async function maybeImportLegacySessions(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem(LOCAL_IMPORT_MARKER) === 'true') {
    return;
  }

  const localSessions = getSessionIndex();
  if (localSessions.length === 0) {
    window.localStorage.setItem(LOCAL_IMPORT_MARKER, 'true');
    return;
  }

  const importedSessions = await Promise.all(
    localSessions.map(async (session) => ({
      sessionId: session.sessionId,
      title: session.title,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      model: session.model,
      messages: await loadThreadMessages(session.sessionId),
    })),
  );

  await importLocalAccountHistory({
    sessions: importedSessions.filter((session) => session.messages.length > 0),
    importedAt: new Date().toISOString(),
  });

  window.localStorage.setItem(LOCAL_IMPORT_MARKER, 'true');
}

export function useAssistantThreads(onRunStateChange?: RuntimeStatusSetter) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<ThreadMessage[]>(messages);
  const sessionIdRef = useRef<string | null>(sessionId);
  const isRunningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runSettlementRef = useRef<Promise<void> | null>(null);
  const resolveRunSettlementRef = useRef<(() => void) | null>(null);

  const updateMessagesState = useCallback((nextMessages: readonly ThreadMessage[]) => {
    const next = [...nextMessages];
    messagesRef.current = next;
    setMessages(next);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    onRunStateChange?.(isRunning);
  }, [isRunning, onRunStateChange]);

  const waitForRunToSettle = useCallback(async () => {
    await (runSettlementRef.current ?? Promise.resolve());
  }, []);

  const reloadSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const serverSessions = await loadServerSessions();
    const localSessions = getSessionIndex();
    const nextSessions = mergeSessionSummaries(serverSessions, localSessions);
    setSessions(nextSessions);
    return nextSessions;
  }, []);

  const persistSnapshot = useCallback(async (targetSessionId: string, snapshot: readonly ThreadMessage[]) => {
    const model = (await fetchRuntimeModel()) ?? loadPreferences().model ?? DEFAULT_MODEL;
    const now = new Date().toISOString();
    const existing = getSessionIndex().find((entry) => entry.sessionId === targetSessionId);
    const title = snapshot.length > 0 ? getThreadTitle(snapshot) : existing?.title ?? formatNewThreadTitle(now);
    const provider = resolveProvider(model).id;

    await saveThreadMessages(targetSessionId, snapshot);
    updateIndex(targetSessionId, {
      title,
      model,
      createdAt: existing?.createdAt ?? now,
      lastActiveAt: now,
      messageCount: snapshot.length,
    });
    setActiveSessionId(targetSessionId);
    try {
      await saveAccountSessionSnapshot(targetSessionId, {
        title,
        model,
        provider,
        createdAt: existing?.createdAt ?? now,
        lastActiveAt: now,
        messages: snapshot as ThreadMessage[],
      });
    } catch {
      // Keep the local cache in sync even if the network is temporarily unavailable.
    }
    await reloadSessions();
  }, [reloadSessions]);

  const createThread = useCallback(async () => {
    const targetSessionId = createSessionId();
    const model = (await fetchRuntimeModel()) ?? loadPreferences().model ?? DEFAULT_MODEL;
    const now = new Date().toISOString();
    const provider = resolveProvider(model).id;
    const title = formatNewThreadTitle(now);

    setError(null);
    setSessionId(targetSessionId);
    sessionIdRef.current = targetSessionId;
    updateMessagesState([]);
    setActiveSessionId(targetSessionId);
    addToIndex(targetSessionId, title, model);
    updateIndex(targetSessionId, {
      title,
      createdAt: now,
      lastActiveAt: now,
      model,
      messageCount: 0,
    });
    await saveThreadMessages(targetSessionId, []);
    try {
      await saveAccountSessionSnapshot(targetSessionId, {
        title,
        model,
        provider,
        createdAt: now,
        lastActiveAt: now,
        messages: [],
      });
    } catch {
      // Best-effort cloud persistence.
    }
    await reloadSessions();
    return targetSessionId;
  }, [reloadSessions, updateMessagesState]);

  const ensureThread = useCallback(async () => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    return createThread();
  }, [createThread]);

  const switchThread = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId || isRunningRef.current || targetSessionId === sessionIdRef.current) {
      return;
    }

    if (sessionIdRef.current) {
      await persistSnapshot(sessionIdRef.current, messagesRef.current);
    }

    setError(null);
    const serverSnapshot = await loadAccountSession(targetSessionId);
    const restoredMessages = serverSnapshot?.messages ?? (await loadThreadMessages(targetSessionId));
    setSessionId(targetSessionId);
    sessionIdRef.current = targetSessionId;
    updateMessagesState(restoredMessages);
    setActiveSessionId(targetSessionId);
    await reloadSessions();

    const model = getSessionIndex().find((entry) => entry.sessionId === targetSessionId)?.model ?? DEFAULT_MODEL;
    await ensureRuntimeSession(targetSessionId, restoredMessages, model);
  }, [persistSnapshot, reloadSessions, updateMessagesState]);

  const sendMessage = useCallback(async (message: AppendMessage) => {
    if (isRunningRef.current || message.role !== 'user') {
      return;
    }

    const activeSessionId = await ensureThread();
    const userMessage = createUserMessage(message);
    const priorMessages = messagesRef.current;
    const nextMessages = [...priorMessages, userMessage];
    const query = getLatestUserQuery(nextMessages);

    setError(null);
    updateMessagesState(nextMessages);

    if (!query) {
      await persistSnapshot(activeSessionId, nextMessages);
      return;
    }

    const preferredModel = loadPreferences().model || DEFAULT_MODEL;
    const model = (await fetchRuntimeModel()) ?? preferredModel;
    const provider = resolveProvider(model).id;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsRunning(true);
    runSettlementRef.current = new Promise<void>((resolve) => {
      resolveRunSettlementRef.current = resolve;
    });

    let state: DexterRunState = {
      text: '',
      reasoningText: '',
      thinkingMessage: '正在连接 Dexter runtime...',
      toolCalls: [],
      done: false,
    };
    let assistantMessage = createAssistantMessage(state);
    const runningMessages = [...nextMessages, assistantMessage];
    updateMessagesState(runningMessages);
    await persistSnapshot(activeSessionId, runningMessages);

    try {
      await ensureRuntimeSession(activeSessionId, priorMessages, model);

      const response = await fetch(`/api/runtime/sessions/${activeSessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          query,
          sessionId: activeSessionId,
          model,
          provider,
          apiKey: getApiKey(provider) ?? undefined,
          history: buildDexterHistoryPayload(priorMessages),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text() || `Chat request failed: ${response.status}`);
      }

      await consumeSSEStream(response, {
        onEvent: (event) => {
          state = applyDexterSseEvent(state, event);
          assistantMessage = {
            ...assistantMessage,
            ...createAssistantMessage(state),
            id: assistantMessage.id,
            createdAt: assistantMessage.createdAt,
          };

          const updatedMessages = replaceMessage(messagesRef.current, assistantMessage.id, assistantMessage);
          updateMessagesState(updatedMessages);
        },
        onError: (streamError) => {
          state = { ...state, error: streamError.message || 'Streaming failed', done: true };
          setError(state.error ?? null);
          assistantMessage = {
            ...assistantMessage,
            ...createAssistantMessage(state),
            id: assistantMessage.id,
            createdAt: assistantMessage.createdAt,
          };
          updateMessagesState(replaceMessage(messagesRef.current, assistantMessage.id, assistantMessage));
        },
        onComplete: () => {
          if (!state.done) {
            state = { ...state, done: true };
            assistantMessage = {
              ...assistantMessage,
              ...createAssistantMessage(state),
              id: assistantMessage.id,
              createdAt: assistantMessage.createdAt,
            };
            updateMessagesState(replaceMessage(messagesRef.current, assistantMessage.id, assistantMessage));
          }
        },
      });

      if (state.error) {
        setError(state.error);
      }
    } catch (runError) {
      if (runError instanceof Error && runError.name === 'AbortError') {
        state = { ...state, done: true, error: '已停止生成' };
      } else {
        const messageText = runError instanceof Error ? runError.message : 'Unable to send query';
        setError(messageText);
        state = { ...state, text: state.text || `Error: ${messageText}`, error: messageText, done: true };
      }

      assistantMessage = {
        ...assistantMessage,
        ...createAssistantMessage(state),
        id: assistantMessage.id,
        createdAt: assistantMessage.createdAt,
      };
      updateMessagesState(replaceMessage(messagesRef.current, assistantMessage.id, assistantMessage));
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
      resolveRunSettlementRef.current?.();
      resolveRunSettlementRef.current = null;
      runSettlementRef.current = null;
      await persistSnapshot(activeSessionId, messagesRef.current);
    }
  }, [ensureThread, persistSnapshot, updateMessagesState]);

  const cancelRun = useCallback(async () => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || !isRunningRef.current) {
      return;
    }

    abortControllerRef.current?.abort();
    await abortRuntimeSession(activeSessionId);
    await waitForRunToSettle();
  }, [waitForRunToSettle]);

  const startNewThread = useCallback(async () => {
    if (isRunningRef.current) {
      await cancelRun();
    }

    await waitForRunToSettle();

    if (sessionIdRef.current) {
      await persistSnapshot(sessionIdRef.current, messagesRef.current);
    }

    await createThread();
  }, [cancelRun, createThread, persistSnapshot, waitForRunToSettle]);

  const approveTool = useCallback(async (
    sessionIdValue: string,
    requestId: string,
    decision: ApprovalDecision,
  ): Promise<void> => {
    try {
      await fetch(`/api/runtime/sessions/${sessionIdValue}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision }),
      });
    } catch {
      setError('授权请求发送失败。');
    }
  }, []);

  const deleteThread = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId || isRunningRef.current) {
      return;
    }

    try {
      await deleteAccountSession(targetSessionId);
    } catch {
      // If the network fails, still clear local state to keep the UI usable.
    }

    await Promise.all([deleteThreadMessages(targetSessionId), saveThreadMessages(targetSessionId, [])]);
    removeFromIndex(targetSessionId);
    const nextSessions = getSessionIndex().filter((session) => session.sessionId !== targetSessionId);
    setSessionId((current) => (current === targetSessionId ? null : current));
    if (sessionIdRef.current === targetSessionId) {
      sessionIdRef.current = null;
    }
    if (sessionId === targetSessionId) {
      updateMessagesState([]);
    }
    setSessions(nextSessions);
    setActiveSessionId(sessionIdRef.current);
    await reloadSessions();
  }, [reloadSessions, sessionId, updateMessagesState]);

  useEffect(() => {
    const initialize = async () => {
      await maybeImportLegacySessions();
      const list = await reloadSessions();
      const activeSessionId = getActiveSessionId();
      if (!activeSessionId || !list.some((entry) => entry.sessionId === activeSessionId)) {
        return;
      }

      const snapshot = await loadAccountSession(activeSessionId);
      const restoredMessages = snapshot?.messages ?? (await loadThreadMessages(activeSessionId));
      setSessionId(activeSessionId);
      sessionIdRef.current = activeSessionId;
      updateMessagesState(restoredMessages);
    };

    void initialize();
  }, [reloadSessions, updateMessagesState]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistSnapshot(sessionId, messagesRef.current);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [messages, persistSnapshot, sessionId]);

  const runtimeStore = useMemo<ExternalStoreAdapter<ThreadMessage>>(
    () => ({
      messages,
      isRunning,
      setMessages: updateMessagesState,
      onNew: sendMessage,
      onCancel: cancelRun,
      unstable_capabilities: { copy: true },
    }),
    [cancelRun, isRunning, messages, sendMessage],
  );

  return {
    sessionId,
    sessions,
    messages,
    isRunning,
    error,
    runtimeStore,
    startNewThread,
    switchThread,
    deleteThread,
    sendMessage,
    cancelRun,
    approveTool,
  };
}

export { mergeSessionSummaries };
