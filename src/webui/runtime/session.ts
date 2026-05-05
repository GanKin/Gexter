import { InMemoryChatHistory } from '../../utils/in-memory-chat-history';
import { registerSession } from './registry';
import type { WebRuntimeSession } from './types';

export type CreateWebRuntimeSessionOptions = {
  sessionId?: string;
  model?: string;
  modelProvider?: string;
  apiKey?: string;
  baseUrl?: string;
};

function getDefaultWebRuntimeModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5.4';
}

function getDefaultWebRuntimeBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL?.trim() || undefined;
}

function getDefaultWebRuntimeApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function createSessionId(requestedId?: string): string {
  return (
    requestedId?.trim() ||
    `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
  );
}

export function createWebRuntimeSession(options: CreateWebRuntimeSessionOptions = {}): WebRuntimeSession {
  const model = options.model ?? getDefaultWebRuntimeModel();
  const sessionId = createSessionId(options.sessionId);

  const session: WebRuntimeSession = {
    id: sessionId,
    model,
    modelProvider: options.modelProvider ?? 'openai',
    apiKey: options.apiKey ?? getDefaultWebRuntimeApiKey(),
    baseUrl: options.baseUrl ?? getDefaultWebRuntimeBaseUrl(),
    createdAt: new Date().toISOString(),
    history: new InMemoryChatHistory(model),
    approvedTools: new Set<string>(),
    pendingApproval: null,
    status: 'idle',
  };

  registerSession(session);

  return session;
}
