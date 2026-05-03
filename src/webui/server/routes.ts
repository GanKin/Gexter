import { getRuntimeHealth } from '../runtime/health';
import { createWebRuntimeSession } from '../runtime/session';

export async function handleWebUiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/runtime/health') {
    if (req.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    return Response.json(await getRuntimeHealth());
  }

  if (url.pathname === '/api/runtime/sessions') {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const session = createWebRuntimeSession();
    return Response.json({
      sessionId: session.id,
      model: session.model,
      status: session.status,
    });
  }

  return new Response('Not found', { status: 404 });
}
