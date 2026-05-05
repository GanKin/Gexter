import { handleSessionModelRequest } from '@/webui/runtime/api';

export const dynamic = 'force-dynamic';

type ModelRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: ModelRouteContext) {
  const { id } = await params;
  return handleSessionModelRequest(request, id);
}
