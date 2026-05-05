import { getModelIdsForProvider } from '@/utils/model';
import { getSession } from '@/webui/runtime/registry';

export const dynamic = 'force-dynamic';

type ModelRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: ModelRouteContext) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  let body: { model?: unknown; provider?: unknown };
  try {
    body = (await request.json()) as { model?: unknown; provider?: unknown };
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

  if (!validModels.includes(model)) {
    return new Response('Invalid model for provider', { status: 400 });
  }

  session.model = model;
  session.modelProvider = provider;
  session.history.setModel(model);

  return Response.json({ ok: true, model });
}
