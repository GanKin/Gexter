import { handleSessionChatRequest } from '@/webui/runtime/api';

export const dynamic = 'force-dynamic';

type ChatRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: ChatRouteContext) {
  const { id } = await params;
  return handleSessionChatRequest(request, id);
}
