import type { ThreadMessage } from '@assistant-ui/react';

import {
  deleteAccountSession,
  importLocalHistory,
  listAccountSessions,
  loadAccountSessionSnapshot,
  requireCurrentUser,
  upsertAccountSessionSnapshot,
} from './account-store';

type SessionUpsertBody = {
  title?: unknown;
  model?: unknown;
  provider?: unknown;
  createdAt?: unknown;
  lastActiveAt?: unknown;
  messages?: unknown;
};

type ImportBody = {
  sessions?: unknown;
  importedAt?: unknown;
};

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

function responseFromError(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Response(message || 'Unexpected error', { status: 500 });
}

function isThreadMessageArray(value: unknown): value is ThreadMessage[] {
  return Array.isArray(value);
}

export async function handleAccountSessionsListRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const user = await requireCurrentUser(request);
    const sessions = await listAccountSessions(user.id);
    return Response.json({ sessions, user });
  } catch (error) {
    return responseFromError(error);
  }
}

export async function handleAccountSessionRequest(request: Request, sessionId: string): Promise<Response> {
  try {
    const user = await requireCurrentUser(request);

    if (request.method === 'GET') {
      const snapshot = await loadAccountSessionSnapshot(user.id, sessionId);
      if (!snapshot) {
        return new Response('Not found', { status: 404 });
      }

      return Response.json(snapshot);
    }

    if (request.method === 'DELETE') {
      await deleteAccountSession(user.id, sessionId);
      return Response.json({ ok: true });
    }

    if (request.method !== 'PUT') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = parseJsonBody<SessionUpsertBody>(await request.text());
    const messages = isThreadMessageArray(body?.messages) ? body.messages : [];
    const snapshot = await upsertAccountSessionSnapshot({
      userId: user.id,
      sessionId,
      title: typeof body?.title === 'string' ? body.title : null,
      model: typeof body?.model === 'string' ? body.model : undefined,
      provider: typeof body?.provider === 'string' ? body.provider : undefined,
      createdAt: typeof body?.createdAt === 'string' ? body.createdAt : null,
      lastActiveAt: typeof body?.lastActiveAt === 'string' ? body.lastActiveAt : null,
      messages,
    });

    return Response.json(snapshot);
  } catch (error) {
    return responseFromError(error);
  }
}

export async function handleAccountImportRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const user = await requireCurrentUser(request);
    const body = parseJsonBody<ImportBody>(await request.text());
    const sessions = Array.isArray(body?.sessions) ? (body.sessions as Array<{
      sessionId?: unknown;
      title?: unknown;
      createdAt?: unknown;
      lastActiveAt?: unknown;
      model?: unknown;
      provider?: unknown;
      messages?: unknown;
    }>) : [];

    const imported = await importLocalHistory({
      userId: user.id,
      importedAt: typeof body?.importedAt === 'string' ? body.importedAt : undefined,
      sessions: sessions
        .filter((session) => typeof session.sessionId === 'string' && typeof session.messages !== 'undefined')
        .map((session) => ({
          sessionId: String(session.sessionId),
          title: typeof session.title === 'string' ? session.title : undefined,
          createdAt: typeof session.createdAt === 'string' ? session.createdAt : undefined,
          lastActiveAt: typeof session.lastActiveAt === 'string' ? session.lastActiveAt : undefined,
          model: typeof session.model === 'string' ? session.model : undefined,
          provider: typeof session.provider === 'string' ? session.provider : undefined,
          messages: Array.isArray(session.messages) ? (session.messages as ThreadMessage[]) : [],
        })),
    });

    return Response.json({ sessions: imported });
  } catch (error) {
    return responseFromError(error);
  }
}

