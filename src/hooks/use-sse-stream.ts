import type { AgentEvent } from '@/agent/types';

export type SSEEvent = AgentEvent | { type: 'error'; message: string };

export type ToolCallInfo = {
  tool: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
  startTime?: number;
};

export type ApprovalRequest = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied';
  decision?: 'allow-once' | 'allow-session' | 'deny';
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'complete' | 'aborted';
  toolCalls: ToolCallInfo[];
  thinking: boolean;
  thinkingMessage: string | null;
  approvalRequest?: ApprovalRequest;
};

type SSEStreamCallbacks = {
  onEvent: (event: SSEEvent) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
};

function isSSEEvent(value: unknown): value is SSEEvent {
  return typeof value === 'object' && value !== null && 'type' in value && typeof (value as { type?: unknown }).type === 'string';
}

function parseEventPayload(payload: string): SSEEvent | null {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === '[DONE]') {
    return null;
  }

  const event = JSON.parse(trimmed) as unknown;
  if (!isSSEEvent(event)) {
    throw new Error('Invalid SSE event payload');
  }

  return event;
}

function consumeBufferedEvents(buffer: string, onEvent: (event: SSEEvent) => void): string {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const payload = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))
      .join('\n');
    const event = parseEventPayload(payload);
    if (event) {
      onEvent(event);
    }
  }

  return remainder;
}

export async function consumeSSEStream(
  response: Response,
  callbacks: SSEStreamCallbacks,
): Promise<void> {
  try {
    if (!response.body) {
      throw new Error('Response body is unavailable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        buffer = consumeBufferedEvents(buffer, callbacks.onEvent);
      }

      if (done) {
        buffer += decoder.decode();
        const tail = buffer.trim();
        if (tail) {
          const event = parseEventPayload(tail.startsWith('data:') ? tail.replace(/^data:\s?/, '') : tail);
          if (event) {
            callbacks.onEvent(event);
          }
        }
        callbacks.onComplete();
        return;
      }
    }
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error('Failed to consume SSE stream'));
  }
}
