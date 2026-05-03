import { getRuntimeHealth } from '@/webui/runtime/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getRuntimeHealth());
}
