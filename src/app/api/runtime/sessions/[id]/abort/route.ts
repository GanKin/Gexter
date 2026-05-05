import { handleSessionAbortRequest } from '@/webui/runtime/api';

export const dynamic = 'force-dynamic';

type AbortRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: AbortRouteContext) {
  const { id } = await params;
  return handleSessionAbortRequest(_request, id);
}
