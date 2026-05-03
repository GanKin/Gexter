export const dynamic = 'force-dynamic';

export async function POST() {
  return Response.json({
    sessionId: `web-${crypto.randomUUID()}`,
    model: 'gpt-5.4',
    status: 'idle',
  });
}
