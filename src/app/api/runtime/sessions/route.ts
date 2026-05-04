import { createWebRuntimeSession } from '@/webui/runtime/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { model?: unknown } | null = null;
  try {
    body = (await request.json()) as { model?: unknown };
  } catch {
    body = null;
  }

  const model = typeof body?.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : undefined;
  const session = createWebRuntimeSession(model);

  return Response.json({
    sessionId: session.id,
    model: session.model,
    status: session.status,
  });
}
