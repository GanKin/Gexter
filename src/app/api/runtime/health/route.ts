import { handleRuntimeHealthRequest } from '@/webui/runtime/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleRuntimeHealthRequest(request);
}
