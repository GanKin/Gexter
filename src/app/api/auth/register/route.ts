import { handleAuthRegisterRequest } from '@/webui/server/auth-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleAuthRegisterRequest(request);
}

