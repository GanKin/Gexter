import type { RunWebSessionOptions, WebRuntimeSession } from './types';

export { getRuntimeHealth } from './health';

export async function runWebSession(
  session: WebRuntimeSession,
  options: RunWebSessionOptions,
): Promise<string> {
  session.status = 'running';
  const abortController = new AbortController();
  session.abortController = abortController;
  const emitEvent = options.onEvent;

  try {
    const { Agent } = await import('../../agent/agent');
    const agent = await Agent.create({
      maxIterations: 10,
      ...options.config,
      sessionApprovedTools: session.approvedTools,
      signal: abortController.signal,
      requestToolApproval: async (request) => {
        const { requestId } = request;
        await emitEvent?.({
          sessionId: session.id,
          event: {
            type: 'tool_approval',
            requestId,
            tool: request.tool,
            args: request.args,
            approved: 'pending',
          },
        });
        return new Promise((resolve, reject) => {
          const abortListener = () => {
            session.pendingApproval = null;
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          };

          if (abortController.signal.aborted) {
            abortListener();
            return;
          }

          abortController.signal.addEventListener('abort', abortListener, { once: true });

          session.pendingApproval = {
            resolve: (decision) => {
              abortController.signal.removeEventListener('abort', abortListener);
              resolve(decision);
            },
            requestId,
            tool: request.tool,
            args: request.args,
          };
        });
      },
    });

    let answer = '';
    for await (const event of agent.run(options.query, session.history)) {
      await options.onEvent?.({ sessionId: session.id, event });
      if (event.type === 'done') {
        answer = event.answer;
      }
    }

    session.status = 'complete';
    return answer;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      session.status = 'aborted';
      return '';
    }
    session.status = 'error';
    throw error;
  } finally {
    session.pendingApproval = null;
    session.abortController = undefined;
  }
}
