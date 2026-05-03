import { InMemoryChatHistory } from '../../utils/in-memory-chat-history';
import type { WebRuntimeSession } from './types';

export function createWebRuntimeSession(model = 'gpt-5.4'): WebRuntimeSession {
  const sessionId = `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  return {
    id: sessionId,
    model,
    createdAt: new Date().toISOString(),
    history: new InMemoryChatHistory(model),
    approvedTools: new Set<string>(),
    status: 'idle',
  };
}
