import { handleCreateSessionRequest } from '@/webui/runtime/api';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handleCreateSessionRequest(request);
}
