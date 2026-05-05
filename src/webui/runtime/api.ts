import { getModelIdsForProvider } from '@/utils/model';

import { runWebSession } from './adapter';
import { getSession } from './registry';
import { createWebRuntimeSession } from './session';
import { STREAMABLE_EVENT_TYPES, type StreamableAgentEvent } from './types';

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type HistoryTurn = {
  id: number;
  query: string;
  answer: string | null;
  summary: string | null;
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

function buildHistoryTurns(historyMessages: HistoryMessage[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
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
  const session = existingSession ?? createWebRuntimeSession({ sessionId, model, modelProvider, apiKey, baseUrl });

  if (existingSession) {
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

  if (!existingSession && Array.isArray(body?.history)) {
    session.history.restore(buildHistoryTurns(body.history as HistoryMessage[]));
  }

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

  let session = getSession(sessionId);
  if (!session) {
    if (!Array.isArray(body.history)) {
      return new Response('Session not found', { status: 404 });
    }

    const model = typeof body.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : undefined;
    const modelProvider = typeof body.provider === 'string' && body.provider.trim().length > 0
      ? body.provider.trim()
      : undefined;
    const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
    const baseUrl = typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0 ? body.baseUrl.trim() : undefined;

    session = createWebRuntimeSession({
      sessionId,
      model,
      modelProvider,
      apiKey,
      baseUrl,
    });

    session.history.restore(buildHistoryTurns(body.history as HistoryMessage[]));
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

  const session = getSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  let body: ModelRequestBody;
  try {
    body = (await request.json()) as ModelRequestBody;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (typeof body.model !== 'string' || body.model.trim().length === 0) {
    return new Response('Missing model', { status: 400 });
  }

  if (typeof body.provider !== 'string' || body.provider.trim().length === 0) {
    return new Response('Missing provider', { status: 400 });
  }

  const model = body.model.trim();
  const provider = body.provider.trim();
  const validModels = getModelIdsForProvider(provider);

  if (validModels.length > 0 && !validModels.includes(model)) {
    return new Response('Invalid model for provider', { status: 400 });
  }

  session.model = model;
  session.modelProvider = provider;
  session.history.setModel(model);
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0) {
    session.baseUrl = body.baseUrl.trim();
  }

  return Response.json({ ok: true, model });
}

export async function handleSessionApproveRequest(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

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
    return new Response('Request ID mismatch', { status: 400 });
  }

  if (body.decision !== 'allow-once' && body.decision !== 'allow-session' && body.decision !== 'deny') {
    return new Response('Invalid decision', { status: 400 });
  }

  const decision = body.decision;
  const pendingApproval = session.pendingApproval;

  if (decision === 'allow-session') {
    session.approvedTools.add(pendingApproval.tool);
  }

  session.pendingApproval = null;
  pendingApproval.resolve(decision);

  return Response.json({ ok: true });
}

export async function handleSessionAbortRequest(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  if (!session.abortController) {
    return new Response('No running session', { status: 409 });
  }

  session.abortController.abort();

  return Response.json({ ok: true, status: 'aborted' });
}
