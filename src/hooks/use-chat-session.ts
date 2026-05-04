'use client';

import { useEffect, useRef, useState } from 'react';

import type { DoneEvent, StreamProgressEvent, ThinkingEvent, ToolEndEvent, ToolErrorEvent, ToolStartEvent } from '@/agent/types';

import { consumeSSEStream, type ChatMessage, type SSEEvent, type ToolCallInfo } from '@/hooks/use-sse-stream';

const SESSION_STORAGE_KEY = 'dexter-session-id';

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

function createInitialSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistSessionId(sessionId: string) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Local storage is best-effort in browsers; continue without persistence if unavailable.
  }
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

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => createInitialSessionId());
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  const streamingRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    streamingRef.current = isStreaming;
  }, [isStreaming]);

  const createNewSession = async (): Promise<string> => {
    const response = await fetch('/api/runtime/sessions', { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.status}`);
    }

    const data = (await response.json()) as { sessionId?: unknown };
    if (typeof data.sessionId !== 'string' || data.sessionId.length === 0) {
      throw new Error('Session response did not include a sessionId');
    }

    sessionIdRef.current = data.sessionId;
    setSessionId(data.sessionId);
    persistSessionId(data.sessionId);
    return data.sessionId;
  };

  const ensureSessionId = async (): Promise<string | null> => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    return createNewSession();
  };

  const createSession = async (): Promise<void> => {
    setError(null);
    await createNewSession();
  };

  const handleEvent = (event: SSEEvent) => {
    if (isThinkingEvent(event)) {
      setMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: true,
          thinkingMessage: event.message,
        })),
      );
      return;
    }

    if (isStreamProgressEvent(event)) {
      setMessages((current) =>
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
      setMessages((current) =>
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
            },
          ],
        })),
      );
      return;
    }

    if (isToolEndEvent(event)) {
      setMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: false,
          thinkingMessage: null,
          toolCalls: updateLatestToolCall(message.toolCalls, event.tool, (toolCall) => ({
            ...toolCall,
            status: 'done',
            result: event.result,
          })),
        })),
      );
      return;
    }

    if (isToolErrorEvent(event)) {
      setMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          thinking: false,
          thinkingMessage: null,
          toolCalls: updateLatestToolCall(message.toolCalls, event.tool, (toolCall) => ({
            ...toolCall,
            status: 'error',
            error: event.error,
          })),
        })),
      );
      return;
    }

    if (isDoneEvent(event)) {
      setMessages((current) =>
        replaceAssistantMessage(current, (message) => ({
          ...message,
          content: event.answer,
          status: 'complete',
          thinking: false,
          thinkingMessage: null,
          toolCalls: mapToolCalls(event.toolCalls),
        })),
      );
      setIsStreaming(false);
      return;
    }

    if (event.type === 'error') {
      const message = typeof event.message === 'string' ? event.message : 'Dexter runtime returned an error';
      setError(message);
      setMessages((current) =>
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

    setMessages((current) => [...current, createUserMessage(normalizedQuery), createEmptyAssistantMessage()]);
    streamingRef.current = true;
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/runtime/sessions/${activeSessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: normalizedQuery }),
      });

      if (!response.ok) {
        throw new Error(await response.text() || `Chat request failed: ${response.status}`);
      }

      await consumeSSEStream(response, {
        onEvent: handleEvent,
        onError: (streamError) => {
          const message = streamError.message || 'Streaming failed';
          setError(message);
          setMessages((current) =>
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
          setMessages((current) =>
            replaceAssistantMessage(current, (assistant) => ({
              ...assistant,
              status: assistant.status === 'complete' ? assistant.status : 'complete',
              thinking: false,
              thinkingMessage: null,
            })),
          );
        },
      });
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : 'Unable to send query';
      setError(message);
      setMessages((current) =>
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
    sendQuery,
    createSession,
    error,
  };
}
