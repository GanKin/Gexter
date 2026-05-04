import { getSession } from '@/webui/runtime/registry';

export const dynamic = 'force-dynamic';

type AbortRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: AbortRouteContext) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  if (!session.abortController) {
    return new Response('No running session', { status: 409 });
  }

  session.abortController.abort();

  return Response.json({ ok: true, status: 'aborted' });
}
