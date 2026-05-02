# Codebase Structure

**Analysis Date:** 2026-05-03

## Directory Layout

```text
Gexter/
├── src/                      # Runtime source tree
│   ├── agent/                # LLM loop, prompts, scratchpad, compaction
│   ├── cli.ts                # CLI/TUI assembly
│   ├── components/           # Ink-style TUI components
│   ├── controllers/          # UI state controllers
│   ├── cron/                 # Persistent scheduler
│   ├── evals/                # LangSmith eval runner and UI
│   ├── gateway/              # WhatsApp gateway, routing, sessions, groups
│   ├── memory/               # Persistent memory store and index
│   ├── model/                # LLM provider abstraction
│   ├── skills/               # Built-in skill discovery and loader
│   ├── tools/                # LangChain tools and tool registry
│   └── utils/                # Shared helpers
├── .dexter/                  # User/runtime state written by the app
├── .planning/codebase/       # Architecture/structure notes
├── package.json              # Scripts and dependencies
└── tsconfig.json             # TypeScript config
```

## Directory Purposes

**`src/agent/`:**
- Purpose: Agent loop, tool execution, prompt construction, compaction, and event types.
- Contains: `agent.ts`, `tool-executor.ts`, `scratchpad.ts`, `prompts.ts`, `compact.ts`, `microcompact.ts`, `run-context.ts`, `token-counter.ts`.
- Key files: `src/agent/agent.ts`, `src/agent/index.ts`, `src/agent/types.ts`

**`src/components/`:**
- Purpose: Render the CLI experience.
- Contains: chat log, answer box, tool rows, approval prompt, input/editor widgets, debug panel, selectors, intro, hints.
- Key files: `src/components/chat-log.ts`, `src/components/tool-event.ts`, `src/components/working-indicator.ts`, `src/components/index.ts`

**`src/controllers/`:**
- Purpose: Hold UI state and side effects that do not belong in presentational components.
- Contains: agent runner state, model selection flow, input history.
- Key files: `src/controllers/agent-runner.ts`, `src/controllers/model-selection.ts`, `src/controllers/input-history.ts`

**`src/gateway/`:**
- Purpose: WhatsApp message intake/output, route resolution, session tracking, group context, and channel orchestration.
- Contains: `gateway.ts`, `agent-runner.ts`, `config.ts`, `routing/`, `sessions/`, `group/`, `channels/`, `heartbeat/`.
- Key files: `src/gateway/index.ts`, `src/gateway/gateway.ts`, `src/gateway/config.ts`, `src/gateway/routing/resolve-route.ts`

**`src/gateway/channels/whatsapp/`:**
- Purpose: Concrete WhatsApp transport implementation.
- Contains: login, runtime monitor, inbound parsing, outbound delivery, reconnect policy, dedupe, auth store, session handling.
- Key files: `src/gateway/channels/whatsapp/index.ts`, `src/gateway/channels/whatsapp/plugin.ts`, `src/gateway/channels/whatsapp/inbound.ts`, `src/gateway/channels/whatsapp/outbound.ts`

**`src/memory/`:**
- Purpose: Persistent memory files, search index, embeddings, and session context loading.
- Contains: `store.ts`, `database.ts`, `indexer.ts`, `search.ts`, `chunker.ts`, `flush.ts`, `embeddings.ts`, `mmr.ts`, `temporal-decay.ts`, `session-files.ts`.
- Key files: `src/memory/index.ts`, `src/memory/store.ts`, `src/memory/database.ts`, `src/memory/indexer.ts`

**`src/cron/`:**
- Purpose: Persistent scheduling and cron job execution.
- Contains: job store, schedule calculations, runner loop, executor, heartbeat migration.
- Key files: `src/cron/runner.ts`, `src/cron/executor.ts`, `src/cron/schedule.ts`, `src/cron/store.ts`, `src/cron/types.ts`

**`src/evals/`:**
- Purpose: Offline evaluation pipeline and TUI progress UI.
- Contains: dataset reader, runner, progress widgets, result views.
- Key files: `src/evals/run.ts`, `src/evals/components/eval-app.ts`, `src/evals/components/index.ts`

**`src/skills/`:**
- Purpose: Discover and load SKILL.md workflows.
- Contains: registry, loader, metadata types, built-in skills.
- Key files: `src/skills/index.ts`, `src/skills/registry.ts`, `src/skills/loader.ts`, `src/skills/types.ts`

**`src/tools/`:**
- Purpose: Expose all LangChain tools and tool descriptions.
- Contains: registry, finance tools, search tools, browser, filesystem, memory wrappers, cron, heartbeat, fetch, skill tool.
- Key files: `src/tools/registry.ts`, `src/tools/index.ts`, `src/tools/types.ts`

**`src/model/`:**
- Purpose: Provider routing and LLM invocation helpers.
- Contains: `llm.ts`.
- Key files: `src/model/llm.ts`

**`src/utils/`:**
- Purpose: Shared low-level helpers for config, logging, paths, tokens, formatting, queues, caches, and error handling.
- Contains: environment helpers, queue utilities, markdown formatting, token estimation, text navigation, progress/spinner support.
- Key files: `src/utils/logger.ts`, `src/utils/config.ts`, `src/utils/env.ts`, `src/utils/paths.ts`

## Key File Locations

**Entry Points:**
- `src/index.tsx`: CLI bootstrap that loads `.env` and calls `runCli()`.
- `src/cli.ts`: Builds the TUI and drives the main user session.
- `src/gateway/index.ts`: Gateway entrypoint for `run` and `login`.
- `src/evals/run.ts`: Evaluation entrypoint.

**Configuration:**
- `package.json`: Scripts, runtime dependencies, bin entry.
- `tsconfig.json`: TypeScript compiler config and path alias `@/* -> src/*`.
- `src/gateway/config.ts`: Gateway/WhatsApp config schemas and persistence.
- `src/utils/config.ts`: App settings persistence used by model selection and memory.

**Core Logic:**
- `src/agent/agent.ts`: Main agent loop and context management.
- `src/gateway/gateway.ts`: Message routing, typing indicator, cron startup, agent dispatch.
- `src/memory/index.ts`: Persistent memory façade.
- `src/cron/runner.ts`: Scheduler loop.
- `src/tools/registry.ts`: Tool registration surface.

**Testing:**
- `*.test.ts` colocated with the code under test, for example `src/gateway/access-control.test.ts`, `src/gateway/routing/resolve-route.test.ts`, `src/gateway/sessions/store.test.ts`, `src/utils/cache.test.ts`.

## Naming Conventions

**Files:**
- Runtime modules use lower-case kebab-case file names, for example `agent-runner.ts`, `resolve-route.ts`, `memory-update.ts`.
- Entry/export modules use `index.ts` in each directory, for example `src/components/index.ts`, `src/tools/index.ts`, `src/skills/index.ts`.
- Test files use `*.test.ts` beside the implementation file.

**Directories:**
- Capability-first directories group code by subsystem, for example `src/tools/finance/`, `src/gateway/channels/whatsapp/`, `src/evals/components/`.
- User/runtime state lives under `.dexter/`, not under `src/`.

## Where to Add New Code

**New Feature:**
- Primary code: place the implementation in the subsystem that owns the behavior, for example `src/agent/` for agent behavior, `src/gateway/` for message routing, `src/memory/` for persistence, or `src/cron/` for scheduling.
- Tests: colocate in `*.test.ts` next to the file that changed.

**New Component/Module:**
- Implementation: add the component under `src/components/` and export it from `src/components/index.ts`.

**Controllers / UI State:**
- Implementation: add orchestration logic under `src/controllers/` rather than inside `src/components/`.

**New Tool:**
- Implementation: add the concrete LangChain tool under the relevant folder in `src/tools/`.
- Registration: add it to `src/tools/registry.ts`.
- Description: keep the prompt-facing description next to the tool implementation.

**New Gateway Channel:**
- Implementation: add a channel plugin under `src/gateway/channels/<channel>/`.
- Registration: plug it into `src/gateway/channels/manager.ts` through a `ChannelPlugin`.

**New Memory Behavior:**
- Implementation: extend `src/memory/` first.
- Tool surface: add or update wrappers in `src/tools/memory/`.

**New Skill:**
- Built-in skill: add `src/skills/<name>/SKILL.md`.
- Project-level override: add `.dexter/skills/<name>/SKILL.md`.

**New Eval Scenario:**
- Runner/data: add files under `src/evals/` and `src/evals/dataset/`.
- UI: add components under `src/evals/components/`.

## Special Directories

**`.dexter/`:**
- Purpose: Persistent runtime state and user-specific configuration.
- Generated: Yes
- Committed: No
- Includes: `settings.json`, `gateway.json`, `cron/jobs.json`, `memory/`, `scratchpad/`, `messages/`, `HEARTBEAT.md`, `credentials/`-backed auth directories.

**`src/skills/`:**
- Purpose: Built-in skill definitions and discovery logic.
- Generated: No
- Committed: Yes

**`src/evals/dataset/`:**
- Purpose: Static evaluation input data.
- Generated: No
- Committed: Yes

**`src/gateway/channels/whatsapp/`:**
- Purpose: Concrete WhatsApp integration.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-03*
