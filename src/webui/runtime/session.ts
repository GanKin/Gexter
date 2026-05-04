import { InMemoryChatHistory } from '../../utils/in-memory-chat-history';
import { registerSession } from './registry';
import type { WebRuntimeSession } from './types';

export function createWebRuntimeSession(model = 'gpt-5.4'): WebRuntimeSession {
  const sessionId = `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  const session: WebRuntimeSession = {
    id: sessionId,
    model,
    createdAt: new Date().toISOString(),
    history: new InMemoryChatHistory(model),
    approvedTools: new Set<string>(),
    pendingApproval: null,
    status: 'idle',
  };

  registerSession(session);

  return session;
}
