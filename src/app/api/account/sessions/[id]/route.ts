import { handleAccountSessionRequest } from '@/webui/server/account-api';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handleAccountSessionRequest(request, id);
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handleAccountSessionRequest(request, id);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return handleAccountSessionRequest(request, id);
}

