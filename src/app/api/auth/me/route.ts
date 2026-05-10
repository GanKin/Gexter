import { handleAuthMeRequest } from '@/webui/server/auth-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleAuthMeRequest(request);
}

