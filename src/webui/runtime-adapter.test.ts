import { describe, expect, test } from 'bun:test';
import { existsSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { Agent } from '../agent/agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history';
import { createWebRuntimeSession } from './runtime/session';
import { getRuntimeHealth, runWebSession } from './runtime/adapter';
import { handleWebUiRequest } from './server/routes';

const settingsPath = join(process.cwd(), '.dexter', 'settings.json');
const backupPath = join(process.cwd(), '.dexter', 'settings.json.test-backup');
const expectedWebUiModel = process.env.OPENAI_MODEL?.trim() || 'gpt-5.4';
const expectedWebUiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || undefined;
const expectedWebUiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;

function withNoSavedSettings<T>(fn: () => Promise<T> | T): Promise<T> | T {
  const hadSettings = existsSync(settingsPath);
  if (hadSettings) {
    renameSync(settingsPath, backupPath);
  }

  const restore = () => {
    if (hadSettings && existsSync(backupPath)) {
      renameSync(backupPath, settingsPath);
    } else if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

describe('webui runtime boundary', () => {
  test('creates a web session with the expected defaults', () => {
    const session = createWebRuntimeSession();

    expect(session.id.startsWith('web-')).toBe(true);
    expect(session.model).toBe(expectedWebUiModel);
    expect(session.baseUrl).toBe(expectedWebUiBaseUrl);
    expect(session.apiKey).toBe(expectedWebUiApiKey);
    expect(session.status).toBe('idle');
    expect(session.history).toBeInstanceOf(InMemoryChatHistory);
    expect(session.approvedTools.size).toBe(0);
  });

  test('returns Dexter webui health with default model when no saved setting exists', async () => {
    await withNoSavedSettings(async () => {
      const health = await getRuntimeHealth();

      expect(health).toEqual({
        ok: true,
        runtime: 'dexter',
        mode: 'webui',
        model: expectedWebUiModel,
        gatewayCompatible: true,
      });
    });
  });

  test('serves the runtime health endpoint', async () => {
    await withNoSavedSettings(async () => {
      const response = await handleWebUiRequest(new Request('http://local/api/runtime/health'));
      expect(response.status).toBe(200);
      const health = await response.json();
      expect(health).toEqual({
        ok: true,
        runtime: 'dexter',
        mode: 'webui',
        model: expectedWebUiModel,
        gatewayCompatible: true,
      });
    });
  });

  test('creates runtime sessions through the API boundary', async () => {
    await withNoSavedSettings(async () => {
      const response = await handleWebUiRequest(
        new Request('http://local/api/runtime/sessions', { method: 'POST' }),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['model', 'sessionId', 'status']);
      expect(body.sessionId).toBeDefined();
      expect(String(body.sessionId)).toMatch(/^web-/);
      expect(body.model).toBe(expectedWebUiModel);
      expect(body.status).toBe('idle');
    });
  });

  test('runs sessions through Agent.create and forwards events', async () => {
    const session = createWebRuntimeSession();
    const agentClass = Agent as typeof Agent & {
      create: typeof Agent.create;
    };
    const originalCreate = agentClass.create;
    let receivedHistory: InMemoryChatHistory | null = null;
    let receivedConfig: Record<string, unknown> | null = null;
    const events: Array<{ sessionId: string; event: { type: string } }> = [];

    agentClass.create = async (config) => {
      receivedConfig = config as Record<string, unknown>;
      return {
        async *run(query: string, history?: InMemoryChatHistory) {
          expect(query).toBe('Ask Dexter about markets');
          receivedHistory = history ?? null;
          yield { type: 'thinking', message: 'thinking' };
          yield {
            type: 'done',
            answer: 'final answer',
            toolCalls: [],
            iterations: 1,
            totalTime: 5,
          };
        },
      } as never;
    };

    try {
      const answer = await runWebSession(session, {
        query: 'Ask Dexter about markets',
        config: { model: 'gpt-4.1-mini', maxIterations: 3 },
        onEvent: async (event) => {
          events.push(event);
        },
      });

      expect(answer).toBe('final answer');
      expect(session.status).toBe('complete');
      expect(receivedHistory as unknown as InMemoryChatHistory).toBe(session.history);
      expect(receivedConfig).toMatchObject({
        model: 'gpt-4.1-mini',
        maxIterations: 3,
        sessionApprovedTools: session.approvedTools,
      });
      expect(events).toHaveLength(2);
      expect(events[0]?.sessionId).toBe(session.id);
      expect(events[0]?.event.type).toBe('thinking');
      expect(events[1]?.event.type).toBe('done');
    } finally {
      agentClass.create = originalCreate;
    }
  });
});
