import { runWebSession } from '@/webui/runtime/adapter';
import { getSession } from '@/webui/runtime/registry';
import { STREAMABLE_EVENT_TYPES, type StreamableAgentEvent } from '@/webui/runtime/types';

export const dynamic = 'force-dynamic';

type ChatRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ErrorEvent = {
  type: 'error';
  message: string;
};

function isErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request, { params }: ChatRouteContext) {
  const { id } = await params;

  let body: { query?: unknown };
  try {
    body = (await request.json()) as { query?: unknown };
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (typeof body.query !== 'string' || body.query.trim().length === 0) {
    return new Response('Missing query', { status: 400 });
  }
  const query = body.query.trim();

  const session = getSession(id);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  if (session.status !== 'idle') {
    return new Response('Session already running', { status: 409 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: StreamableAgentEvent | ErrorEvent): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      void (async () => {
        try {
          await runWebSession(session, {
          query,
          config: {
            model: session.model,
            modelProvider: session.modelProvider,
            apiKey: session.apiKey,
          },
          onEvent: (event) => {
              if (STREAMABLE_EVENT_TYPES.has(event.event.type as StreamableAgentEvent['type'])) {
                sendEvent(event.event as StreamableAgentEvent);
              }
            },
          });
        } catch (error) {
          if (!(error instanceof Error && error.name === 'AbortError')) {
            sendEvent({
              type: 'error',
              message: isErrorMessage(error),
            });
          }
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
