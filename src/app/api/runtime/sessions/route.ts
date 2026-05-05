import { createWebRuntimeSession } from '@/webui/runtime/session';
import { getSession } from '@/webui/runtime/registry';

export const dynamic = 'force-dynamic';

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
  history?: unknown;
};

export async function POST(request: Request) {
  let body: CreateSessionBody | null = null;
  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    body = null;
  }

  const model = typeof body?.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : undefined;
  const modelProvider = typeof body?.provider === 'string' && body.provider.trim().length > 0
    ? body.provider.trim()
    : undefined;
  const apiKey = typeof body?.apiKey === 'string' && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
  const sessionId = typeof body?.sessionId === 'string' && body.sessionId.trim().length > 0
    ? body.sessionId.trim()
    : undefined;

  const existingSession = sessionId ? getSession(sessionId) : undefined;
  const session = existingSession ?? createWebRuntimeSession({ sessionId, model, modelProvider, apiKey });

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
  }

  if (!existingSession && Array.isArray(body?.history)) {
    const historyMessages = body.history as HistoryMessage[];
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

    session.history.restore(turns);
  }

  return Response.json({
    sessionId: session.id,
    model: session.model,
    provider: session.modelProvider,
    status: session.status,
  });
}
