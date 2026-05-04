import { getSession } from '@/webui/runtime/registry';

export const dynamic = 'force-dynamic';

type ApproveRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ApprovalDecision = 'allow-once' | 'allow-session' | 'deny';

export async function POST(request: Request, { params }: ApproveRouteContext) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  if (!session.pendingApproval) {
    return new Response('No pending approval', { status: 409 });
  }

  let body: { decision?: unknown; requestId?: unknown };
  try {
    body = (await request.json()) as { decision?: unknown; requestId?: unknown };
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (body.requestId !== session.pendingApproval.requestId) {
    return new Response('Request ID mismatch', { status: 400 });
  }

  if (body.decision !== 'allow-once' && body.decision !== 'allow-session' && body.decision !== 'deny') {
    return new Response('Invalid decision', { status: 400 });
  }

  const decision = body.decision as ApprovalDecision;
  const pendingApproval = session.pendingApproval;

  if (decision === 'allow-session') {
    session.approvedTools.add(pendingApproval.tool);
  }

  session.pendingApproval = null;
  pendingApproval.resolve(decision);

  return Response.json({ ok: true });
}
