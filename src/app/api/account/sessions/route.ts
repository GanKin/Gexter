import { handleAccountSessionsListRequest } from '@/webui/server/account-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleAccountSessionsListRequest(request);
}

