import { createWebRuntimeSession } from '@/webui/runtime/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = createWebRuntimeSession();

  return Response.json({
    sessionId: session.id,
    model: session.model,
    status: session.status,
  });
}
