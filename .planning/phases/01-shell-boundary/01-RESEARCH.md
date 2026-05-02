# Phase 01: Shell & Boundary - Research

**Researched:** 2026-05-03
**Domain:** Brownfield TypeScript/Bun CLI agent wrapped by a local browser WebUI
**Confidence:** HIGH

## User Constraints

No `01-CONTEXT.md` exists for this phase, so there are no additional locked decisions from `/gsd:discuss-phase`.

From `.planning/REQUIREMENTS.md` and `.planning/STATE.md`:
- Core value: 把 Dexter 的现有能力安全地暴露成一个好用的 Web 入口，同时不破坏已经成熟的核心引擎。
- Phase 1 must cover `WEB-01`, `WEB-02`, `WEB-09`, `WEB-10`.
- This is a brownfield wrapper. Do not rewrite `agent`, `tool`, `memory`, `cron`, or `gateway`.
- CLI must remain supported alongside the WebUI.
- Public SaaS auth, new financial data capabilities, and replacing the CLI are out of scope.

## Project Constraints (from AGENTS.md)

- Always answer in Simplified Chinese for user-facing output.
- Use Bun for project commands: `bun install`, `bun run start`, `bun run dev`, `bun run typecheck`, `bun test`.
- Language is strict TypeScript ESM; avoid `any`.
- Keep files concise; extract helpers instead of duplicating code.
- Add comments only for tricky or non-obvious logic.
- Do not add logging unless explicitly asked.
- Do not create README or documentation files unless explicitly asked.
- Never commit `.env` files or real API keys.
- `.dexter/settings.json` and `.env` are gitignored user/runtime state.
- Existing release/publish/push operations require user confirmation.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEB-01 | User can open a browser-based Dexter workspace connected to a local Dexter runtime. | Use Vite React for the browser shell and a local Bun HTTP boundary with a runtime health endpoint. |
| WEB-02 | User can start a new session from the webui without changing Dexter core code paths. | Add a WebUI adapter beside CLI/gateway that imports `Agent` and consumes `AgentEvent`; do not fork `Agent.run()`. |
| WEB-09 | Existing Dexter CLI usage continues to work after the webui is added. | Keep `src/index.tsx`, `src/cli.ts`, and existing `start`/`dev` scripts intact; add separate web scripts and tests. |
| WEB-10 | Existing gateway/background features continue to work after the webui is added. | Keep `src/gateway/index.ts`, `src/gateway/gateway.ts`, `src/gateway/agent-runner.ts`, cron startup, and gateway scripts intact; add compatibility smoke checks. |

## Summary

Dexter already has the right internal seam for WebUI: `src/agent/agent.ts` exposes an async event stream through `Agent.run()`, while CLI and gateway each adapt that stream to their own surface. Phase 1 should add a third adapter for WebUI rather than modifying the agent loop, tool registry, memory, cron, or gateway execution semantics.

The browser shell should be a small Vite + React + TypeScript app with React Router in Declarative Mode. The local runtime boundary should be explicit and narrow: a WebUI runtime adapter module that can create/start a session and expose a health/status contract. Actual chat streaming can be prepared via SSE-compatible design but does not need full conversation implementation until Phase 2.

**Primary recommendation:** Add `src/webui/` as a separate presentation/runtime-adapter layer, backed by Vite React for the browser and Bun HTTP endpoints for local runtime access, while preserving all existing CLI and gateway entrypoints unchanged.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | `19.2.5` published 2026-04-30 | Browser UI components | Official React + TypeScript guidance supports JSX and typed components with `@types/react`. |
| `react-dom` | `19.2.5` published 2026-04-30 | Browser rendering via `createRoot` | Required companion package for React DOM rendering. |
| `vite` | `8.0.10` published 2026-04-23 | WebUI dev server and production build | Official Vite docs position it as a modern dev server/build tool with React TS templates and Bun commands. |
| `@vitejs/plugin-react` | `6.0.1` published 2026-03-13 | React transform/HMR for Vite | Official React plugin path for Vite projects. |
| `react-router-dom` | `7.14.2` published 2026-04-22 | Browser routes | React Router docs recommend Declarative Mode when using routing as simply as possible with `<BrowserRouter>`. |
| Bun HTTP server | Project runtime; binary currently missing locally | Local runtime/API boundary | Bun docs support `Bun.serve`, routes, ports, lifecycle methods, and SSE-compatible streaming responses. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/react` | `19.2.14` published 2026-04-01 | React TS types | Required for typed React components. |
| `@types/react-dom` | `19.2.3` published 2025-11-12 | React DOM TS types | Required for typed browser entrypoint. |
| `bun:test` | Built into Bun | Unit/smoke tests | Existing repo standard; tests are colocated as `*.test.ts`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite SPA | Next.js / React Router Framework Mode | More framework behavior, server bundles, and deployment assumptions than Phase 1 needs. |
| React Router Declarative Mode | React Router Framework Mode | Framework Mode is powerful, but Phase 1 only needs a local browser shell and simple routes. |
| Bun HTTP routes | Express/Hono/Fastify | Adds another server framework before requirements justify middleware complexity. |
| SSE-ready event stream | WebSocket | WebSocket is useful later for bidirectional interaction; Phase 2 streaming can start with SSE because agent output is server-to-browser. |

**Installation:**

```bash
bun add react react-dom react-router-dom
bun add -d vite @vitejs/plugin-react @types/react @types/react-dom
```

**Version verification:** Checked with `npm view <package> version time.modified --json` on 2026-05-03 because `bun` is not available in this environment.

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── webui/
│   ├── client/
│   │   ├── app.tsx              # browser app composition and routes
│   │   ├── main.tsx             # React DOM entrypoint
│   │   ├── routes/              # shell/workspace pages
│   │   └── styles.css           # WebUI-only styles
│   ├── server/
│   │   ├── index.ts             # Bun HTTP server entrypoint
│   │   ├── routes.ts            # route dispatch and static/API boundary
│   │   └── static.ts            # production asset serving if needed
│   ├── runtime/
│   │   ├── adapter.ts           # only WebUI-to-Dexter runtime boundary
│   │   ├── session.ts           # WebUI session model, no core duplication
│   │   └── types.ts             # transport-safe event/session types
│   └── runtime-adapter.test.ts
└── ...
```

### Pattern 1: Presentation Adapter Around `Agent.run()`

**What:** Keep `Agent` as the source of runtime behavior and translate its `AgentEvent` stream into WebUI-safe session/events.

**When to use:** Every WebUI action that needs Dexter behavior, including starting a new session.

**Example:**

```ts
// Source: existing src/controllers/agent-runner.ts and src/gateway/agent-runner.ts
const agent = await Agent.create({
  model,
  modelProvider,
  maxIterations: 10,
  signal,
  requestToolApproval,
  sessionApprovedTools,
  messageQueue,
});

for await (const event of agent.run(query, inMemoryHistory)) {
  emitWebEvent(toWebRuntimeEvent(event));
}
```

### Pattern 2: Separate Web Scripts, No Entrypoint Mutation

**What:** Add scripts such as `webui:dev`, `webui:build`, and `webui:start` without changing `start`, `dev`, `gateway`, or `gateway:login`.

**When to use:** Phase 1 compatibility requirement for CLI/gateway coexistence.

**Example:**

```json
{
  "scripts": {
    "start": "bun run src/index.tsx",
    "dev": "bun --watch run src/index.tsx",
    "gateway": "tsx src/gateway/index.ts run",
    "gateway:login": "tsx src/gateway/index.ts login",
    "webui:dev": "vite --host 127.0.0.1",
    "webui:start": "bun run src/webui/server/index.ts"
  }
}
```

### Pattern 3: Narrow Runtime Health Contract

**What:** Phase 1 should prove the page is connected to a local Dexter runtime without implementing the full chat stream.

**When to use:** `WEB-01` and shell smoke checks.

**Example:**

```ts
export type RuntimeHealth = {
  ok: boolean;
  runtime: 'dexter';
  mode: 'webui';
  model: string;
  gatewayCompatible: true;
};

export async function getRuntimeHealth(): Promise<RuntimeHealth> {
  return {
    ok: true,
    runtime: 'dexter',
    mode: 'webui',
    model: getSetting('modelId', 'gpt-5.4') as string,
    gatewayCompatible: true,
  };
}
```

### Anti-Patterns to Avoid

- **Copying `AgentRunnerController` into WebUI:** It contains CLI display-state assumptions. Extract or wrap only reusable runtime concepts.
- **Changing `src/index.tsx` for WebUI:** The CLI bootstrap must stay untouched for `WEB-09`.
- **Changing `startGateway()` to support WebUI:** Gateway owns WhatsApp/cron lifecycle and should not become the WebUI backend.
- **Putting WebUI state into `.dexter/settings.json` in Phase 1:** Later UI preferences belong to `WEB-08`; Phase 1 only needs shell/session boundary.
- **Adding auth/user accounts:** v1 explicitly excludes public SaaS authentication.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser bundling/HMR | Custom TS/JSX compiler or static script concatenation | Vite | Handles ESM, TS, JSX, CSS, HMR, and production build. |
| Client routing | Manual `location.pathname` router | React Router Declarative Mode | Avoids edge cases around navigation state, links, history, and nested routes. |
| Dexter runtime loop | Duplicate `Agent.run()` logic | `Agent.create()` + `agent.run()` | Existing loop already owns tools, approval, compaction, memory, queue drain, and final answer. |
| Session history type | Ad hoc message arrays in UI components | `InMemoryChatHistory` or a WebUI wrapper around it | Keeps behavior consistent with CLI/gateway session handling. |
| Streaming transport details | Raw chunk parsing with bespoke protocol | SSE-compatible event encoding | Bun docs support `text/event-stream`; Phase 2 can reuse this. |
| Gateway compatibility validation | Manual “looks fine” check | Import/start smoke tests and script checks | Prevents accidental entrypoint/script regressions. |

**Key insight:** The hard behavior in Dexter is not rendering; it is the agent loop and long-lived local state. WebUI should only translate browser actions into runtime calls and translate runtime events into browser-safe event payloads.

## Common Pitfalls

### Pitfall 1: Treating WebUI as a New Agent Runtime

**What goes wrong:** WebUI grows its own tool calling, memory, queue, or approval loop.
**Why it happens:** Browser session concepts look similar to agent runtime concepts.
**How to avoid:** Keep `src/webui/runtime/adapter.ts` as the only bridge and import `Agent` from `src/agent/agent.ts`.
**Warning signs:** New code imports `getTools()`, `callLlmWithMessages()`, or `Scratchpad` directly from WebUI.

### Pitfall 2: Breaking CLI by Renaming Shared Presentation Files

**What goes wrong:** Existing `bun run start` fails because CLI files or scripts changed for WebUI.
**Why it happens:** Current CLI code lives near generic names like `src/cli.ts`, `src/controllers/*`, and `src/components/*`.
**How to avoid:** Add `src/webui/*`; do not move existing CLI components in Phase 1.
**Warning signs:** Diffs touch `src/index.tsx`, `src/cli.ts`, or `src/components/*` without a direct compatibility reason.

### Pitfall 3: Gateway Side Effects During WebUI Startup

**What goes wrong:** Opening WebUI starts WhatsApp, cron, auth stores, or gateway logs.
**Why it happens:** Reusing gateway runner because it already wraps `Agent`.
**How to avoid:** WebUI adapter should mirror the useful pattern from `src/gateway/agent-runner.ts`, not import `startGateway()`.
**Warning signs:** WebUI imports from `src/gateway/gateway.ts` or starts cron.

### Pitfall 4: Bun SSE Idle Timeout

**What goes wrong:** Long-running agent event streams disconnect after quiet periods.
**Why it happens:** Bun defaults idle connections to 10 seconds, including streaming responses.
**How to avoid:** When Phase 2 adds streaming, call `server.timeout(req, 0)` for SSE routes or emit heartbeat events.
**Warning signs:** Browser sees reset connections during long tool calls with no chunks.

### Pitfall 5: TypeScript Config Coupling

**What goes wrong:** Browser DOM types, Vite config, or React JSX assumptions disturb CLI/gateway typecheck.
**Why it happens:** Current `tsconfig.json` is broad (`include: ["src/**/*"]`) and built for strict ESM.
**How to avoid:** Add a small `tsconfig.web.json` or keep WebUI code compatible with the existing compiler settings; validate `bun run typecheck`.
**Warning signs:** DOM or JSX type errors appear in unrelated CLI/gateway modules.

## Code Examples

### WebUI Runtime Adapter Skeleton

```ts
// Source pattern: src/controllers/agent-runner.ts, src/gateway/agent-runner.ts
import { Agent } from '../../agent/agent.js';
import { InMemoryChatHistory } from '../../utils/in-memory-chat-history.js';
import type { AgentConfig, AgentEvent } from '../../agent/types.js';

export type WebRuntimeSession = {
  id: string;
  history: InMemoryChatHistory;
  approvedTools: Set<string>;
};

export async function runWebSession(
  session: WebRuntimeSession,
  query: string,
  config: AgentConfig,
  onEvent: (event: AgentEvent) => void | Promise<void>,
): Promise<string> {
  const agent = await Agent.create({
    ...config,
    sessionApprovedTools: session.approvedTools,
  });

  let answer = '';
  for await (const event of agent.run(query, session.history)) {
    await onEvent(event);
    if (event.type === 'done') answer = event.answer;
  }
  return answer;
}
```

### Bun Health Route

```ts
// Source: Bun HTTP server docs, https://bun.com/docs/runtime/http/server
import { getRuntimeHealth } from '../runtime/adapter.js';

export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === '/api/runtime/health') {
      return Response.json(await getRuntimeHealth());
    }
    return new Response('Not found', { status: 404 });
  },
};
```

### Future SSE Route Shape

```ts
// Source: Bun SSE docs, https://bun.com/docs/guides/http/sse
routes: {
  '/api/sessions/:id/events': (req, server) => {
    server.timeout(req, 0);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  },
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App for simple React shells | Vite React TypeScript | Vite 8 docs current in 2026 | Use Vite, not CRA or custom bundling. |
| React Router as one mode | React Router 7 with Framework/Data/Declarative modes | React Router 7 docs current in 2026 | Choose Declarative Mode for this small SPA shell. |
| Separate Node server framework by default | Bun can serve HTTP routes directly | Bun docs current in 2026 | Avoid Express/Hono unless middleware needs appear. |
| Streaming without idle strategy | Bun SSE routes must account for idle timeout | Bun docs current in 2026 | Plan `server.timeout(req, 0)` or heartbeat events before chat streaming. |

**Deprecated/outdated:**
- Create React App: not recommended for this phase; Vite is the documented modern baseline for React TS scaffolding.
- React Router Framework Mode: not deprecated, but too much for Phase 1 because no SSR/data-router requirements exist.

## Open Questions

1. **Should WebUI dev mode run one process or two?**
   - What we know: Vite dev server is ideal for frontend HMR; Bun server is ideal for the local runtime API.
   - What's unclear: Whether the final UX should be `bun run webui:dev` only, or separate frontend/backend scripts.
   - Recommendation: Plan a single convenience script after Bun is installed, but keep client/server modules separate.

2. **Where should WebUI session persistence land?**
   - What we know: Phase 1 only requires starting a new session; Phase 4 covers reopening prior sessions.
   - What's unclear: Whether WebUI sessions should later reuse `.dexter/messages` or get their own namespace.
   - Recommendation: Use in-memory sessions in Phase 1 and define transport-safe types now; defer persistence.

3. **Should Phase 1 include real agent execution from WebUI?**
   - What we know: `WEB-02` says start a new session from WebUI without core path changes, not complete chat streaming.
   - What's unclear: Whether “start” means creating a session record or sending a first prompt.
   - Recommendation: Plan minimal adapter tests for session creation and health; leave prompt streaming to Phase 2 unless scope expands.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun CLI | All project install/run/test commands | ✗ | — | None for compliant execution; install Bun first. |
| `node` | Vite compatibility, npm metadata checks | ✓ | `v25.7.0` | — |
| `npm` | Package metadata verification only | ✓ | `11.10.1` | Use only for `npm view`; project commands should remain Bun. |
| `node_modules` | Local typecheck/test execution | ✗ | — | `bun install` after Bun is available. |
| `tsx` executable | Existing gateway scripts through local dependency | ✗ currently, package dependency exists | — | `bun install` should provide `node_modules/.bin/tsx`. |
| Browser | Manual WebUI verification | not probed | — | Vite local URL plus later browser smoke test. |

**Missing dependencies with no fallback:**
- `bun` is not on `PATH`; this blocks `bun install`, `bun run typecheck`, `bun test`, and all repo-standard execution.

**Missing dependencies with fallback:**
- `node_modules` and local `tsx` are missing but should be restored by `bun install` once Bun is installed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun built-in test runner; version unavailable because `bun` is missing |
| Config file | `package.json` scripts; `jest.config.js` exists for legacy compatibility |
| Quick run command | `bun test src/webui/runtime-adapter.test.ts src/controllers/agent-runner.test.ts src/gateway/routing/resolve-route.test.ts` |
| Full suite command | `bun run typecheck && bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WEB-01 | Browser shell can load and call `/api/runtime/health` | smoke/unit | `bun test src/webui/runtime-adapter.test.ts` | ❌ Wave 0 |
| WEB-02 | WebUI session creation uses `Agent` adapter path, not duplicated core logic | unit | `bun test src/webui/runtime-adapter.test.ts` | ❌ Wave 0 |
| WEB-09 | Existing CLI entrypoint and scripts remain unchanged/importable | smoke/typecheck | `bun run typecheck` plus optional `bun run start` manual smoke | ✅ script exists; automated smoke missing |
| WEB-10 | Gateway entrypoint remains importable and scripts remain unchanged | smoke/typecheck | `bun run typecheck && bun test src/gateway/routing/resolve-route.test.ts src/gateway/sessions/store.test.ts` | ✅ partial |

### Sampling Rate

- **Per task commit:** `bun test src/webui/runtime-adapter.test.ts` when WebUI adapter changes; otherwise targeted colocated test.
- **Per wave merge:** `bun run typecheck && bun test`.
- **Phase gate:** Full suite green, then manual smoke that CLI, gateway command parsing, and WebUI shell start independently.

### Wave 0 Gaps

- [ ] Install Bun or add it to `PATH` before execution.
- [ ] Run `bun install` to restore `node_modules`.
- [ ] Add `src/webui/runtime-adapter.test.ts` for `WEB-01` and `WEB-02`.
- [ ] Add a compatibility test or script check for unchanged `start`, `dev`, `gateway`, and `gateway:login` scripts.
- [ ] Add Vite config and web TypeScript config if needed for client compile isolation.

## Sources

### Primary (HIGH confidence)

- Project code: `src/agent/agent.ts`, `src/agent/types.ts`, `src/controllers/agent-runner.ts`, `src/gateway/agent-runner.ts`, `src/gateway/gateway.ts`, `src/index.tsx`, `src/gateway/index.ts`.
- Project planning docs: `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/TESTING.md`.
- Vite official docs: https://vite.dev/guide/ - Vite 8.0.10, React TS templates, Bun commands, Node compatibility, `index.html` as entry.
- React Router official docs: https://reactrouter.com/start/modes - version 7.14.2 and mode guidance.
- Bun HTTP server docs: https://bun.com/docs/runtime/http/server - `Bun.serve`, ports, lifecycle, idle timeout, routes.
- Bun SSE docs: https://bun.com/docs/guides/http/sse - `text/event-stream` and EventSource-compatible streaming.
- React TypeScript docs: https://react.dev/learn/typescript - `@types/react` and `@types/react-dom`.
- Bun overview docs: https://bun.sh/docs - Bun runtime/package manager/test runner/bundler capabilities.

### Secondary (MEDIUM confidence)

- npm registry metadata via `npm view` on 2026-05-03 for package versions and publish dates.

### Tertiary (LOW confidence)

- None used for recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions verified from npm registry and official docs checked.
- Architecture: HIGH - based on existing project entrypoints and reusable `AgentEvent` stream.
- Pitfalls: HIGH - derived from current code structure, gateway/cron side effects, and Bun official timeout behavior.
- Environment: HIGH - probed local `PATH`, Node/npm versions, missing Bun, and missing `node_modules`.

**Research date:** 2026-05-03
**Valid until:** 2026-06-02 for stack/version recommendations; re-check versions before implementation.
