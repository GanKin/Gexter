import { handleAccountImportRequest } from '@/webui/server/account-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleAccountImportRequest(request);
}

