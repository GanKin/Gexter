import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function readPackageJson(): Record<string, unknown> {
  return JSON.parse(read('package.json')) as Record<string, unknown>;
}

describe('webui compatibility', () => {
  test('webui does not mutate existing entrypoint scripts', () => {
    const packageJson = readPackageJson();
    const scripts = packageJson.scripts as Record<string, string>;

    expect(scripts.start).toBe('bun run src/index.tsx');
    expect(scripts.dev).toBe('bun --watch run src/index.tsx');
    expect(scripts.gateway).toBe('tsx src/gateway/index.ts run');
    expect(scripts['gateway:login']).toBe('tsx src/gateway/index.ts login');

    expect(scripts['webui:dev']).toBe('next dev --hostname 127.0.0.1 --port 5173');
    expect(scripts['webui:build']).toBe('next build');
    expect(scripts['webui:preview']).toBe('next start --hostname 127.0.0.1 --port 4173');
    expect(scripts['webui:start']).toBe('bun run src/webui/server/index.ts');
  });

  test('webui runtime avoids gateway and core duplication imports', () => {
    const combined = [
      read('src/webui/runtime/adapter.ts'),
      read('src/webui/runtime/api.ts'),
      read('src/webui/runtime/session.ts'),
      read('src/webui/server/routes.ts'),
      read('src/webui/server/index.ts'),
      read('src/app/api/runtime/health/route.ts'),
      read('src/app/api/runtime/sessions/route.ts'),
      read('src/components/workspace-shell.tsx'),
      read('src/webui/client/routes/workspace.tsx'),
    ].join('\n');

    for (const forbidden of [
      'startGateway',
      'startCronRunner',
      'ensureHeartbeatCronJob',
      'getTools',
      'Scratchpad',
      'callLlmWithMessages',
      '../gateway/gateway',
      '../../gateway/gateway',
      'src/tools/registry',
      'src/model/llm',
    ]) {
      expect(combined).not.toContain(forbidden);
    }

    expect(read('src/webui/runtime/adapter.ts')).toContain('Agent.create');
    expect(read('src/webui/runtime/adapter.ts')).toContain('agent.run(options.query, session.history)');
    expect(read('src/webui/runtime/health.ts')).toContain("getSetting('modelId', 'gpt-5.4')");
    expect(read('src/webui/runtime/api.ts')).toContain('createWebRuntimeSession');
    expect(read('src/webui/runtime/api.ts')).toContain('sessionId: session.id');
    expect(read('src/webui/client/routes/workspace.tsx')).toContain('WorkspaceShell');
    expect(read('src/components/workspace-shell.tsx')).toContain('Reasoning');
    expect(read('src/components/workspace-shell.tsx')).not.toContain('Dexter 正在思考...');
  });

  test('existing cli and gateway entry files remain present', () => {
    for (const file of ['src/index.tsx', 'src/cli.ts', 'src/gateway/index.ts', 'src/gateway/gateway.ts']) {
      expect(existsSync(join(root, file))).toBe(true);
    }
  });
});
