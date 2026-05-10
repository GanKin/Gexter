import type { ThreadMessage } from '@assistant-ui/react';

import { resolveProvider } from '@/providers';
import { getModelIdsForProvider } from '@/utils/model';
import type { Message as RuntimeHistoryMessage } from '@/utils/in-memory-chat-history';

import { runWebSession } from './adapter';
import { getSession } from './registry';
import { createWebRuntimeSession } from './session';
import { STREAMABLE_EVENT_TYPES, type StreamableAgentEvent } from './types';
import {
  getCurrentUser,
  loadAccountSessionSnapshot,
  upsertAccountSessionSnapshot,
  type AccountSessionSnapshot,
} from '../server/account-store';

type HistoryInputMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ThreadMessageLike = {
  id: string;
  role: 'user' | 'assistant';
  content: Array<{ type: string; [key: string]: unknown }>;
  createdAt: string | Date;
  status?: { type: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

type CreateSessionBody = {
  sessionId?: unknown;
  model?: unknown;
  provider?: unknown;
  apiKey?: unknown;
  baseUrl?: unknown;
  history?: unknown;
};

type ChatRequestBody = {
  query?: unknown;
  sessionId?: unknown;
  model?: unknown;
  provider?: unknown;
  apiKey?: unknown;
  baseUrl?: unknown;
  history?: unknown;
};

type ModelRequestBody = {
  model?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
};

type ApproveRequestBody = {
  decision?: unknown;
  requestId?: unknown;
};

function isErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonBody<T>(body: string | null): T | null {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function getMessageText(message: Pick<ThreadMessageLike, 'content'>): string {
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => String(part.text ?? ''))
    .join('\n\n')
    .trim();
}

function buildHistoryTurns(historyMessages: HistoryInputMessage[]): RuntimeHistoryMessage[] {
  const turns: RuntimeHistoryMessage[] = [];
  let pendingQuery: string | null = null;

  for (const message of historyMessages) {
    if (message.role === 'user') {
      pendingQuery = message.content;
      continue;
    }

    if (message.role === 'assistant' && pendingQuery !== null) {
      turns.push({
        id: turns.length,
        query: pendingQuery,
        answer: message.content,
        summary: null,
      });
      pendingQuery = null;
    }
  }

  return turns;
}

function threadMessagesToTurns(messages: ThreadMessage[]): RuntimeHistoryMessage[] {
  const turns: RuntimeHistoryMessage[] = [];
  let pendingUser: string | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      const query = getMessageText(message as unknown as ThreadMessageLike);
      pendingUser = query.length > 0 ? query : null;
      continue;
    }

    if (message.role === 'assistant' && pendingUser) {
      const answer = getMessageText(message as unknown as ThreadMessageLike);
      turns.push({
        id: turns.length,
        query: pendingUser,
        answer: answer.length > 0 ? answer : null,
        summary: null,
      });
      pendingUser = null;
    }
  }

  return turns;
}

function buildThreadMessagesFromHistory(history: RuntimeHistoryMessage[]): ThreadMessage[] {
  const messages: ThreadMessage[] = [];

  for (const entry of history) {
    messages.push({
      id: `user-${entry.id}-${crypto.randomUUID()}`,
      role: 'user',
      content: [{ type: 'text', text: entry.query }] as never,
      createdAt: new Date(),
      attachments: [],
      metadata: {
        unstable_state: null,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {},
      } as never,
    } as ThreadMessage);

    if (entry.answer) {
      messages.push({
        id: `assistant-${entry.id}-${crypto.randomUUID()}`,
        role: 'assistant',
        content: [{ type: 'text', text: entry.answer }] as never,
        createdAt: new Date(),
        status: { type: 'complete', reason: 'stop' } as never,
        metadata: {
          unstable_state: null,
          unstable_annotations: [],
          unstable_data: [],
          steps: [],
          custom: {},
        } as never,
      } as ThreadMessage);
    }
  }

  return messages;
}

function buildSessionSnapshotFromRuntime(sessionId: string, model: string, history: RuntimeHistoryMessage[]): AccountSessionSnapshot {
  const threadMessages = buildThreadMessagesFromHistory(history);
  const provider = resolveProvider(model).id;
  return {
    sessionId,
    title: '新会话',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    model,
    provider,
    messageCount: threadMessages.length,
    messages: threadMessages,
  };
}

async function resolveSessionForUser(request: Request, sessionId: string): Promise<{
  session: ReturnType<typeof createWebRuntimeSession>;
  userId: string;
} | Response> {
  const user = await getCurrentUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const existingSession = getSession(sessionId);
  if (existingSession) {
    if (existingSession.userId && existingSession.userId !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    existingSession.userId = user.id;
    return { session: existingSession, userId: user.id };
  }

  const snapshot = await loadAccountSessionSnapshot(user.id, sessionId);
  if (!snapshot) {
    return new Response('Session not found', { status: 404 });
  }
  const session = createWebRuntimeSession({
    sessionId,
    userId: user.id,
    model: snapshot.model ?? user.preferredModel ?? undefined,
    modelProvider: snapshot.provider ?? user.preferredProvider ?? undefined,
  });

  session.history.restore(threadMessagesToTurns(snapshot.messages));

  return { session, userId: user.id };
}

export async function handleRuntimeHealthRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { getRuntimeHealth } = await import('./health');
  return Response.json(await getRuntimeHealth());
}

export async function handleCreateSessionRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = parseJsonBody<CreateSessionBody>(await request.text());
  const model = typeof body?.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : undefined;
  const modelProvider = typeof body?.provider === 'string' && body.provider.trim().length > 0
    ? body.provider.trim()
    : undefined;
  const apiKey = typeof body?.apiKey === 'string' && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
  const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl.trim().length > 0 ? body.baseUrl.trim() : undefined;
  const sessionId = typeof body?.sessionId === 'string' && body.sessionId.trim().length > 0
    ? body.sessionId.trim()
    : undefined;

  const existingSession = sessionId ? getSession(sessionId) : undefined;
  const session = existingSession ?? createWebRuntimeSession({ sessionId, userId: user.id, model, modelProvider, apiKey, baseUrl });
  session.userId = user.id;

  if (existingSession) {
    if (existingSession.userId && existingSession.userId !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    if (model) {
      existingSession.model = model;
      existingSession.history.setModel(model);
    }
    if (modelProvider) {
      existingSession.modelProvider = modelProvider;
    }
    if (apiKey) {
      existingSession.apiKey = apiKey;
    }
    if (baseUrl) {
      existingSession.baseUrl = baseUrl;
    }
  }

  const historyMessages = Array.isArray(body?.history) ? (body.history as HistoryInputMessage[]) : [];
  if (!existingSession && historyMessages.length > 0) {
    session.history.restore(buildHistoryTurns(historyMessages));
  }

  const snapshot = buildSessionSnapshotFromRuntime(session.id, session.model, session.history.getMessages());
  await upsertAccountSessionSnapshot({
    userId: user.id,
    sessionId: snapshot.sessionId,
    title: snapshot.title,
    createdAt: snapshot.createdAt,
    lastActiveAt: snapshot.lastActiveAt,
    model: snapshot.model,
    provider: snapshot.provider,
    messages: snapshot.messages,
  });

  return Response.json({
    sessionId: session.id,
    model: session.model,
    provider: session.modelProvider,
    status: session.status,
  });
}

export async function handleSessionChatRequest(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (typeof body.query !== 'string' || body.query.trim().length === 0) {
    return new Response('Missing query', { status: 400 });
  }
  const query = body.query.trim();

  const user = await getCurrentUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let session = getSession(sessionId);
  if (session) {
    if (session.userId && session.userId !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }
    session.userId = user.id;
  } else {
    const snapshot = await loadAccountSessionSnapshot(user.id, sessionId);
    if (snapshot) {
      session = createWebRuntimeSession({
        sessionId,
        userId: user.id,
        model: snapshot.model ?? user.preferredModel ?? undefined,
        modelProvider: snapshot.provider ?? user.preferredProvider ?? undefined,
      });
      session.history.restore(threadMessagesToTurns(snapshot.messages));
    } else if (Array.isArray(body.history)) {
      session = createWebRuntimeSession({
        sessionId,
        userId: user.id,
        model: typeof body.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : user.preferredModel ?? undefined,
        modelProvider:
          typeof body.provider === 'string' && body.provider.trim().length > 0
            ? body.provider.trim()
            : user.preferredProvider ?? undefined,
        apiKey: typeof body.apiKey === 'string' && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined,
        baseUrl: typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0 ? body.baseUrl.trim() : undefined,
      });
      session.history.restore(buildHistoryTurns(body.history as HistoryInputMessage[]));
    } else {
      return new Response('Session not found', { status: 404 });
    }
  }

  if (session.status !== 'idle') {
    return new Response('Session already running', { status: 409 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: StreamableAgentEvent | { type: 'error'; message: string }): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      void (async () => {
        try {
          await runWebSession(session, {
            query,
            config: {
              model: session.model,
              modelProvider: session.modelProvider,
              apiKey: session.apiKey,
              baseUrl: session.baseUrl,
            },
            onEvent: (event) => {
              if (STREAMABLE_EVENT_TYPES.has(event.event.type as StreamableAgentEvent['type'])) {
                sendEvent(event.event as StreamableAgentEvent);
              }
            },
          });
        } catch (error) {
          if (!(error instanceof Error && error.name === 'AbortError')) {
            sendEvent({
              type: 'error',
              message: isErrorMessage(error),
            });
          }
        } finally {
          try {
            const snapshot = buildSessionSnapshotFromRuntime(session.id, session.model, session.history.getMessages());
            await upsertAccountSessionSnapshot({
              userId: user.id,
              sessionId: snapshot.sessionId,
              title: snapshot.title,
              createdAt: snapshot.createdAt,
              lastActiveAt: snapshot.lastActiveAt,
              model: snapshot.model,
              provider: snapshot.provider,
              messages: snapshot.messages,
            });
          } catch {
            // Best-effort persistence.
          }
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handleSessionModelRequest(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== 'PATCH') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const resolved = await resolveSessionForUser(request, sessionId);
  if (resolved instanceof Response) {
    return resolved;
  }

  const { session, userId } = resolved;

  let body: ModelRequestBody;
  try {
    body = (await request.json()) as ModelRequestBody;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (typeof body.model !== 'string' || body.model.trim().length === 0) {
    return new Response('Missing model', { status: 400 });
  }

  const model = body.model.trim();
  const provider = typeof body.provider === 'string' && body.provider.trim().length > 0 ? body.provider.trim() : session.modelProvider;
  const allowedModels = getModelIdsForProvider(provider);
  const acceptsAnyModel = provider === 'ollama' || provider === 'local';
  if (!acceptsAnyModel && allowedModels.length > 0 && !allowedModels.includes(model)) {
    return new Response('Invalid model', { status: 400 });
  }

  session.model = model;
  session.modelProvider = provider;
  session.history.setModel(model);
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0) {
    session.baseUrl = body.baseUrl.trim();
  }

  const snapshot = buildSessionSnapshotFromRuntime(session.id, session.model, session.history.getMessages());
  await upsertAccountSessionSnapshot({
    userId,
    sessionId: snapshot.sessionId,
    title: snapshot.title,
    createdAt: snapshot.createdAt,
    lastActiveAt: snapshot.lastActiveAt,
    model: snapshot.model,
    provider: snapshot.provider,
    messages: snapshot.messages,
  });

  return Response.json({ ok: true, model: session.model, provider: session.modelProvider });
}

export async function handleSessionApproveRequest(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const resolved = await resolveSessionForUser(request, sessionId);
  if (resolved instanceof Response) {
    return resolved;
  }

  const { session } = resolved;

  if (!session.pendingApproval) {
    return new Response('No pending approval', { status: 409 });
  }

  let body: ApproveRequestBody;
  try {
    body = (await request.json()) as ApproveRequestBody;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (body.requestId !== session.pendingApproval.requestId) {
    return new Response('Approval request mismatch', { status: 409 });
  }

  if (body.decision !== 'allow-once' && body.decision !== 'allow-session' && body.decision !== 'deny') {
    return new Response('Invalid decision', { status: 400 });
  }

  const pendingApproval = session.pendingApproval;
  const decision = body.decision;
  pendingApproval.resolve(decision);
  if (decision === 'allow-session') {
    session.approvedTools.add(pendingApproval.tool);
  }

  session.pendingApproval = null;

  return Response.json({ ok: true });
}

export async function handleSessionAbortRequest(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const resolved = await resolveSessionForUser(request, sessionId);
  if (resolved instanceof Response) {
    return resolved;
  }

  const { session } = resolved;
  if (!session.abortController) {
    return new Response('No running session', { status: 409 });
  }

  session.abortController.abort();
  return Response.json({ ok: true, status: 'aborted' });
}
