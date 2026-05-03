import type { RunWebSessionOptions, WebRuntimeSession } from './types';

export { getRuntimeHealth } from './health';

export async function runWebSession(
  session: WebRuntimeSession,
  options: RunWebSessionOptions,
): Promise<string> {
  session.status = 'running';

  try {
    const { Agent } = await import('../../agent/agent');
    const agent = await Agent.create({
      maxIterations: 10,
      sessionApprovedTools: session.approvedTools,
      ...options.config,
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
    session.status = 'error';
    throw error;
  }
}
