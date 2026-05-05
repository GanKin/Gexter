import { handleSessionApproveRequest } from '@/webui/runtime/api';

export const dynamic = 'force-dynamic';

type ApproveRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: ApproveRouteContext) {
  const { id } = await params;
  return handleSessionApproveRequest(request, id);
}
