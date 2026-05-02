# Architecture

**Analysis Date:** 2026-05-03

## Pattern Overview

**Overall:** 双入口编排 + 工具驱动的研究内核

**Key Characteristics:**
- `src/index.tsx` 和 `src/gateway/index.ts` 是两个顶层入口，分别面向 CLI 交互和 WhatsApp 网关运行。
- `src/agent/` 持有 LLM 循环、工具调用、上下文压缩和事件流转，其他层主要负责编排与适配。
- `src/tools/registry.ts`、`src/model/llm.ts`、`src/skills/registry.ts` 把外部能力统一封装后再注入到 agent。
- `src/memory/`、`src/cron/`、`src/gateway/` 都通过清晰的边界接入 agent，而不是把业务逻辑散落在 UI 或入口文件里。

## Layers

**CLI Presentation Layer:**
- Purpose: 负责终端界面、输入、状态展示和用户交互。
- Location: `src/index.tsx`, `src/cli.ts`, `src/components/`, `src/controllers/`, `src/theme.ts`
- Contains: TUI 初始化、聊天记录渲染、模型选择、输入历史、审批弹窗、工作状态展示。
- Depends on: `src/controllers/`, `src/agent/`, `src/utils/`, `src/components/`
- Used by: `bun run start`, `bun run dev`

**Gateway Runtime Layer:**
- Purpose: 负责 WhatsApp 通道、路由、会话、群聊上下文和后台调度。
- Location: `src/gateway/`, `src/gateway/channels/`, `src/gateway/group/`, `src/gateway/routing/`, `src/gateway/sessions/`
- Contains: 网关配置、通道插件、WhatsApp 监听与发送、路由解析、会话串行化、群聊历史缓冲。
- Depends on: `src/agent/`, `src/cron/`, `src/utils/`, `src/model/llm.ts`
- Used by: `src/gateway/index.ts`

**Agent Core Layer:**
- Purpose: 负责一次查询的完整推理循环、工具执行、上下文管理和最终回答生成。
- Location: `src/agent/`
- Contains: `Agent`、`AgentToolExecutor`、`Scratchpad`、系统提示构建、上下文压缩、微压缩、运行上下文、事件类型。
- Depends on: `src/model/llm.ts`, `src/tools/registry.ts`, `src/memory/`, `src/providers.ts`, `src/utils/`
- Used by: `src/cli.ts`, `src/gateway/agent-runner.ts`, `src/evals/run.ts`, `src/cron/executor.ts`

**Tool Layer:**
- Purpose: 把外部能力包装成 LangChain 工具并提供系统提示描述。
- Location: `src/tools/`
- Contains: 财务数据、搜索、浏览器、文件系统、记忆、心跳、cron、skill 工具。
- Depends on: `src/memory/`, `src/cron/`, `src/skills/`, `src/gateway/`, `src/model/llm.ts`
- Used by: `src/agent/agent.ts` 及其工具执行器

**Memory Layer:**
- Purpose: 提供长期记忆、会话上下文、嵌入索引和相似度检索。
- Location: `src/memory/`
- Contains: SQLite 索引、磁盘存储、分块、嵌入、混合搜索、Temporal Decay、MMR、会话转录索引。
- Depends on: `src/utils/config.ts`, `src/utils/paths.ts`, `src/model/llm.ts`
- Used by: `src/agent/agent.ts`, `src/tools/memory/`, `src/memory/flush.ts`

**Cron Layer:**
- Purpose: 提供持久化调度、一次性任务、循环任务和 heartbeat 任务迁移。
- Location: `src/cron/`
- Contains: `jobs.json` 存储、调度计算、任务执行、启动器、heartbeat 迁移。
- Depends on: `src/gateway/agent-runner.ts`, `src/gateway/channels/whatsapp/index.ts`, `src/model/llm.ts`
- Used by: `src/gateway/gateway.ts`, `src/tools/cron/cron-tool.ts`, `src/tools/heartbeat/heartbeat-tool.ts`

**Skills Layer:**
- Purpose: 提供可发现、可覆盖的专门工作流。
- Location: `src/skills/`
- Contains: SKILL.md 发现、frontmatter 解析、技能元数据缓存、技能工具。
- Depends on: `src/utils/paths.ts`
- Used by: `src/tools/skill.ts`, `src/tools/registry.ts`, `src/agent/prompts.ts`

**Evaluation Layer:**
- Purpose: 运行离线评测并输出交互式进度。
- Location: `src/evals/`
- Contains: 数据集读取、LangSmith 集成、TUI 进度组件、结果面板。
- Depends on: `src/agent/agent.ts`, `src/model/llm.ts`, `langsmith`
- Used by: `bun run src/evals/run.ts`

**Model / Provider Layer:**
- Purpose: 统一不同 LLM provider 的初始化、重试、流式调用和输出抽象。
- Location: `src/model/llm.ts`, `src/providers.ts`
- Contains: provider 解析、API key 读取、streaming / invoke 封装、Anthropic prompt caching。
- Depends on: `@langchain/*`, `src/utils/errors.ts`, `src/agent/prompts.ts`
- Used by: `src/agent/agent.ts`, `src/memory/flush.ts`, `src/evals/run.ts`

## Data Flow

**CLI Query Flow:**
1. `src/index.tsx` 读取环境变量后调用 `src/cli.ts`。
2. `src/cli.ts` 组装 `src/components/` 和 `src/controllers/`，再把输入交给 `src/controllers/agent-runner.ts`。
3. `src/controllers/agent-runner.ts` 调用 `src/agent/agent.ts` 生成查询事件流。
4. `src/agent/agent.ts` 通过 `src/tools/registry.ts` 绑定工具，并通过 `src/model/llm.ts` 调用模型。
5. 事件回流到 `src/components/chat-log.ts`、`src/components/working-indicator.ts`、`src/components/tool-event.ts` 等组件。

**Gateway Message Flow:**
1. `src/gateway/index.ts` 启动 `src/gateway/gateway.ts`。
2. `src/gateway/gateway.ts` 通过 `src/gateway/channels/manager.ts` 拉起 WhatsApp 插件。
3. `src/gateway/channels/whatsapp/inbound.ts` 把消息解析成 `WhatsAppInboundMessage`，再交给 `src/gateway/gateway.ts`。
4. `src/gateway/routing/resolve-route.ts` 计算 agent 路由和 session key，`src/gateway/agent-runner.ts` 串行化同一会话的运行。
5. `src/agent/agent.ts` 处理消息后，`src/gateway/channels/whatsapp/outbound.ts` 发送回复。

**Memory Flow:**
1. `src/agent/agent.ts` 在 `Agent.create()` 中调用 `MemoryManager.get()`。
2. `src/memory/index.ts` 从 `src/memory/store.ts`、`src/memory/database.ts`、`src/memory/indexer.ts` 组装存储与检索。
3. `src/tools/memory/` 把 `memory_search`、`memory_get`、`memory_update` 暴露给模型。
4. `src/memory/flush.ts` 在上下文接近阈值时把可持久化的记忆写回 `src/memory/store.ts` 管理的 Markdown 文件。

**Cron Flow:**
1. `src/gateway/gateway.ts` 在启动时调用 `startCronRunner()` 和 `ensureHeartbeatCronJob()`。
2. `src/tools/cron/cron-tool.ts` 读写 `src/cron/store.ts` 管理的 `jobs.json`。
3. `src/cron/runner.ts` 轮询到期任务并串行执行。
4. `src/cron/executor.ts` 通过 `src/gateway/agent-runner.ts` 调起隔离 agent，再通过 `src/gateway/channels/whatsapp/outbound.ts` 投递结果。

**Eval Flow:**
1. `src/evals/run.ts` 读取 `src/evals/dataset/finance_agent.csv`。
2. `src/evals/run.ts` 调用 `Agent.create()` 和 `agent.run()`。
3. `src/evals/components/eval-app.ts`、`src/evals/components/eval-progress.ts` 和相关组件展示进度与评分。
4. LangSmith 通过 `langsmith` 客户端接收数据集与评估结果。

**State Management:**
- UI 会话状态存在于 `src/controllers/agent-runner.ts`、`src/controllers/model-selection.ts` 和 `src/controllers/input-history.ts`。
- 运行时查询历史存在于 `src/utils/in-memory-chat-history.ts`，用于 agent 会话重放。
- 长期 scratchpad 写入 `.dexter/scratchpad/`，由 `src/agent/scratchpad.ts` 管理。
- 记忆文件写入 `.dexter/memory/`，由 `src/memory/store.ts` 管理。
- cron 状态写入 `.dexter/cron/jobs.json`，由 `src/cron/store.ts` 管理。
- 网关配置写入 `.dexter/gateway.json`，由 `src/gateway/config.ts` 管理。

## Key Abstractions

**`Agent` / `AgentToolExecutor`:**
- Purpose: 把模型输出、工具调用、审批、并发与事件流统一到一次查询循环中。
- Examples: `src/agent/agent.ts`, `src/agent/tool-executor.ts`
- Pattern: 先发事件，再执行工具，再把结果写回 scratchpad 和消息历史。

**`Scratchpad` / `RunContext`:**
- Purpose: 保存一次查询的工具调用、思考内容和限额提示。
- Examples: `src/agent/scratchpad.ts`, `src/agent/run-context.ts`
- Pattern: JSONL 追加写入，运行态字段只保留在内存中。

**`GatewayConfig` / `ResolvedRoute` / `ChannelPlugin`:**
- Purpose: 把网关配置、路由和通道生命周期解耦。
- Examples: `src/gateway/config.ts`, `src/gateway/routing/resolve-route.ts`, `src/gateway/channels/types.ts`
- Pattern: 先用配置解析账户，再用插件启动通道，最后把消息映射到 agent 会话。

**`MemoryManager` / `MemoryStore` / `MemoryDatabase` / `MemoryIndexer`:**
- Purpose: 把持久化记忆拆成文件存储、索引数据库和增量同步器。
- Examples: `src/memory/index.ts`, `src/memory/store.ts`, `src/memory/database.ts`, `src/memory/indexer.ts`
- Pattern: 磁盘文件是事实源，SQLite 是索引与检索层。

**`CronJob` / `CronStore` / `CronSchedule`:**
- Purpose: 表达可持久化的调度任务和下一次执行时间。
- Examples: `src/cron/types.ts`, `src/cron/store.ts`, `src/cron/schedule.ts`
- Pattern: `jobs.json` 是单一持久化状态，执行器只更新状态字段。

**`SkillMetadata` / `Skill`:**
- Purpose: 支持 SKILL.md 的发现、覆盖和按需加载。
- Examples: `src/skills/types.ts`, `src/skills/registry.ts`, `src/skills/loader.ts`
- Pattern: 发现阶段只读 frontmatter，执行阶段再加载完整指令。

## Entry Points

**`src/index.tsx`:**
- Location: `src/index.tsx`
- Triggers: `bun run start`, `bun run dev`
- Responsibilities: 加载 `.env`，然后调用 `runCli()`。

**`src/cli.ts`:**
- Location: `src/cli.ts`
- Triggers: 来自 `src/index.tsx`
- Responsibilities: 初始化 TUI、控制器和组件树，调度 agent 查询与渲染。

**`src/gateway/index.ts`:**
- Location: `src/gateway/index.ts`
- Triggers: `bun run gateway`, `bun run gateway:login`
- Responsibilities: 启动网关服务或执行 WhatsApp 登录与配置引导。

**`src/evals/run.ts`:**
- Location: `src/evals/run.ts`
- Triggers: `bun run src/evals/run.ts`
- Responsibilities: 跑数据集、记录结果、驱动 LangSmith 评测。

**`src/model/llm.ts`:**
- Location: `src/model/llm.ts`
- Triggers: 被 `src/agent/agent.ts`、`src/memory/flush.ts`、`src/evals/run.ts` 调用
- Responsibilities: 统一 provider 初始化、重试、流式和非流式调用。

## Error Handling

**Strategy:** 优先局部降级，其次返回结构化事件，最后才把错误终止为用户可读文本。

**Patterns:**
- `src/model/llm.ts` 对 provider 调用做指数退避重试，并把不可重试错误直接抛出。
- `src/agent/agent.ts` 在流式调用失败时回退到 blocking invoke，并在上下文溢出时执行截断。
- `src/agent/tool-executor.ts` 对 `write_file`、`edit_file` 走审批门控，对失败工具写入错误结果而不是静默跳过。
- `src/gateway/channels/whatsapp/outbound.ts` 先校验 allowlist，再发送消息。
- `src/cron/executor.ts` 对任务错误做回退、重试和禁用处理。

## Cross-Cutting Concerns

**Logging:** `src/utils/logger.ts` 提供结构化日志；`src/gateway/gateway.ts` 和 `src/cron/*.ts` 额外写入 `gateway-debug.log`。

**Validation:** `zod` schema 用于 `src/gateway/config.ts`、`src/tools/*` 的参数校验，以及 `src/skills/loader.ts` 的 frontmatter 校验。

**Authentication:** LLM API key 通过 `src/model/llm.ts` 读取环境变量；WhatsApp 凭据目录和登录状态通过 `src/gateway/config.ts`、`src/gateway/channels/whatsapp/auth-store.ts`、`src/gateway/channels/whatsapp/session.ts` 管理。

**Concurrency:** `src/agent/tool-executor.ts` 只对声明为 concurrency-safe 的工具并发执行；`src/gateway/agent-runner.ts` 以 session key 串行化同一会话的运行。

---

*Architecture analysis: 2026-05-03*
