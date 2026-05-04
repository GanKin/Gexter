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

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => createInitialSessionId());
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState('gpt-5.4');
  const sessionIdRef = useRef<string | null>(sessionId);
  const streamingRef = useRef(false);
  const currentModelRef = useRef(currentModel);
  const modelOverrideRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    streamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  useEffect(() => {
    const loadCurrentModel = async () => {
      try {
        const response = await fetch('/api/runtime/health');
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { model?: unknown };
        if (!modelOverrideRef.current && typeof data.model === 'string' && data.model.length > 0) {
          setCurrentModel(data.model);
        }
      } catch {
        // Ignore health failures; fallback to the default model until a session is created.
      }
    };

    void loadCurrentModel();
  }, []);

  const createNewSession = async (): Promise<string> => {
    const response = await fetch('/api/runtime/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: currentModelRef.current }),
    });
    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.status}`);
    }

    const data = (await response.json()) as { sessionId?: unknown; model?: unknown };
    if (typeof data.sessionId !== 'string' || data.sessionId.length === 0) {
      throw new Error('Session response did not include a sessionId');
    }

    sessionIdRef.current = data.sessionId;
    setSessionId(data.sessionId);
    if (typeof data.model === 'string' && data.model.length > 0) {
      setCurrentModel(data.model);
    }
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

  const changeModel = async (model: string, provider: string): Promise<void> => {
    modelOverrideRef.current = true;
    currentModelRef.current = model;
    setCurrentModel(model);

    if (!sessionIdRef.current) {
      return;
    }

    try {
      await fetch(`/api/runtime/sessions/${sessionIdRef.current}/model`, {
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
              startTime: Date.now(),
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
      setMessages((current) =>
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
      setMessages((current) =>
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
      setMessages((current) =>
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
      setMessages((current) =>
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
              status: assistant.status === 'complete' ? assistant.status : 'aborted',
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
    currentModel,
    changeModel,
    sendQuery,
    createSession,
    approveTool,
    abortSession,
    error,
  };
}
