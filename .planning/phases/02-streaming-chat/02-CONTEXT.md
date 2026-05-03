# Phase 02 — Streaming Chat: Context

## 1. Domain

Phase 2 的目标是让浏览器能发起研究会话并接收流式回复。这不是搭建一个新的聊天系统，而是把 Dexter Agent 已有的 `AsyncGenerator<AgentEvent>` 事件流通过 WebUI 层暴露给浏览器用户。

**核心约束**：
- 不改动 Agent 核心（`src/agent/agent.ts`）的事件产出逻辑
- 不引入 WebSocket 或额外服务端依赖
- 保持 CLI 和 Gateway 入口不受影响（Phase 1 已验证）

**用户故事**：
1. 用户在浏览器输入问题，点击发送
2. 页面实时显示 Agent 的思考状态、文本流式产出和工具调用概要
3. 回复完成后，聊天记录保留在当前 tab 内

## 2. Decisions

以下 5 个灰区经过讨论已收敛：

### D-01: 传输协议 — SSE (Server-Sent Events)

- **选择**: SSE
- **理由**: Agent 事件流是单向推送（服务端→浏览器），SSE 原生匹配此模式。Next.js App Router 的 Route Handler 原生支持 `ReadableStream` 返回 SSE，无需引入新依赖。用户输入通过普通 POST 发送。
- **替代方案已否决**: WebSocket（双向通道不必要，增加服务端复杂度）、长轮询（延迟高，不适合流式体验）

### D-02: 会话归属 — Tab 级别 + localStorage 存 sessionId

- **选择**: 会话绑定到浏览器 tab，同时将 sessionId 存入 localStorage 作为 Phase 4 持久化的铺路
- **理由**: Phase 2 的成功标准是"流式聊天能跑起来"，不要求跨 tab 或刷新恢复。但存 sessionId 成本极低，为 Phase 4 省去迁移工作。
- **边界**: Phase 2 不实现刷新恢复会话内容，只保存引用。服务端 session 仍然是纯内存。

### D-03: 历史写入责任 — 混合方案

- **选择**: Agent 事件驱动实时 UI，`done` 事件后写入 `session.history`
- **理由**: 前端从 SSE 事件流自行构建 UI 状态（thinking → stream_progress → tool_start → done），不依赖服务端历史查询。`runWebSession` 的 `onEvent` 回调在收到 `done` 后调用 `session.history.saveAnswer()`，为 Phase 4 恢复做准备。
- **实现细节**: 前端维护本地消息数组，每条消息有 `status: 'streaming' | 'complete'` 和 `content` 字段。SSE 事件更新此数组，不回读服务端。

### D-04: API 放置位置 — `/api/runtime/sessions/:id/chat`

- **选择**: `POST /api/runtime/sessions/:id/chat` 返回 SSE 流
- **理由**: 语义清晰（对某个会话发起聊天），和现有 `/api/runtime/sessions`（POST 创建会话）保持一致的命名空间。实现用 Next.js Route Handler。
- **请求格式**: `{ "query": "..." }`
- **响应格式**: `text/event-stream`，每个事件的 `data` 是 JSON 序列化的 `AgentEvent`

### D-05: 事件展示粒度 — 中等

- **选择**: 推送以下事件到前端
  - `thinking` — 显示思考状态指示
  - `stream_progress` — 文本流式增量渲染（`charDelta`, `mode`）
  - `tool_start` — 工具开始调用（显示工具名和参数概要）
  - `tool_end` — 工具调用完成
  - `tool_error` — 工具调用失败
  - `done` — 最终结果（包含 answer、toolCalls 汇总、耗时）
- **不推送**: `microcompact`、`compaction`、`context_cleared`、`queue_drain`、`memory_recalled`、`memory_flush` — 这些是内部优化事件，对用户没有即时价值。
- **Phase 3 扩展**: `tool_approval` 和 `tool_denied` 留到 Phase 3（Run Transparency），那时才需要交互式审批 UI。

## 3. Canonical Refs

以下文件是 Phase 2 规划和执行的权威参考：

| 文件 | 角色 |
|------|------|
| `src/agent/types.ts` | AgentEvent 全部 16 种类型定义、StreamMode 枚举 |
| `src/agent/agent.ts` | `Agent.run()` AsyncGenerator，事件产出逻辑 |
| `src/model/llm.ts` | `streamLlmWithMessages()` 流式 LLM 调用 |
| `src/webui/runtime/types.ts` | WebRuntimeSession、RunWebSessionOptions、WebRuntimeEvent |
| `src/webui/runtime/adapter.ts` | `runWebSession()` — 连接 WebUI 和 Agent 的适配器 |
| `src/webui/runtime/session.ts` | `createWebRuntimeSession()` — 会话工厂 |
| `src/webui/server/routes.ts` | 现有 HTTP 路由（health, sessions） |
| `src/utils/in-memory-chat-history.ts` | InMemoryChatHistory — 会话历史管理器 |
| `src/components/workspace-shell.tsx` | Phase 1 的前端 shell，Phase 2 需要改造 |
| `src/app/api/runtime/health/route.ts` | Next.js Route Handler 示例（Phase 1） |
| `src/app/api/runtime/sessions/route.ts` | Next.js Route Handler 示例（Phase 1） |

## 4. Code Context

### 事件流路径（已存在，Phase 2 接入）

```
Agent.run(query, history)           // AsyncGenerator<AgentEvent>
  ↓ yield events
runWebSession(session, options)     // onEvent callback → Phase 2: 转发到 SSE
  ↓
SSE Response                        // Phase 2 新增：Next.js Route Handler
  ↓
浏览器 EventSource / fetch           // Phase 2 新增：前端消费
```

### 前端状态模型（Phase 2 新增）

```typescript
// 前端聊天消息（从 SSE 事件构建）
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;            // 逐步追加（stream_progress）
  status: 'streaming' | 'complete';
  toolCalls?: ToolCallInfo[]; // 从 tool_start/tool_end 构建
  thinking?: boolean;         // 从 thinking 事件设置
};

type ToolCallInfo = {
  tool: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: string;
};
```

### SSE 事件格式

```
event: message
data: {"type":"thinking","message":"Analyzing market data..."}

event: message
data: {"type":"stream_progress","charDelta":12,"mode":"responding"}

event: message
data: {"type":"tool_start","tool":"searchFilings","args":{"query":"AAPL 10-K"}}

event: message
data: {"type":"tool_end","tool":"searchFilings","result":"..."}

event: message
data: {"type":"done","answer":"...","toolCalls":[...],"iterations":3,"totalTime":4200}
```

### 会话存储（Phase 2 范围）

- 服务端: 内存 Map<sessionId, WebRuntimeSession>（Phase 2 不做持久化）
- 客户端: localStorage 存 `dexter-session-id`（仅存 ID 引用）

## 5. Specifics

### 必须交付的功能

1. **聊天输入区域**: 改造现有 disabled 的 Textarea 为可用的输入框，支持 Enter 发送
2. **SSE 端点**: `POST /api/runtime/sessions/[id]/chat` 返回 `text/event-stream`
3. **会话管理**: 创建会话 → 发起聊天 → 接收流式回复的完整流程
4. **流式文本渲染**: `stream_progress` 事件逐步追加文本到当前 assistant 消息
5. **状态指示**: `thinking` 显示加载状态，`tool_start/end` 显示工具调用概要
6. **消息列表**: 前端维护 user/assistant 消息数组，支持多轮对话

### 不在 Phase 2 范围

- 工具审批交互（`tool_approval` / `tool_denied`）— Phase 3
- 会话恢复和持久化 — Phase 4
- 停止/重试控制 — Phase 3
- 模型/provider 选择器 — Phase 3
- 移动端适配 — Phase 5

### 技术要点

- SSE 用 `fetch` + `ReadableStream` 而非 `EventSource`（因为需要 POST + 自定义 headers）
- Next.js Route Handler 返回 `new Response(readable, { headers: { 'Content-Type': 'text/event-stream' } })`
- 服务端需要维护一个 session registry（Map），让 chat 端点能根据 URL 参数找到对应 session
- `runWebSession` 的 `onEvent` 回调需要做事件过滤（只转发 D-05 中列出的 6 种事件）

## 6. Deferred

以下内容在 Phase 2 执行中可能需要重新评估：

- **SSE 重连策略**: 如果 Agent 运行时间很长（>5min），SSE 连接可能断开。是否需要 Last-Event-ID 恢复？建议推迟到 Phase 4 或视实际体验决定。
- **并发请求**: 同一个 session 同时发两个 chat 请求怎么处理？建议服务端加锁（session.status = 'running' 时拒绝新请求）。
- **错误事件格式**: Agent 的 `tool_error` 是否需要额外包装（如加 `sessionId`）？看 `WebRuntimeEvent` 已有 `sessionId` 字段，应复用。
- **历史截断**: 长会话的 history 会越来越大，前端消息列表是否需要虚拟滚动？建议推迟到 Phase 5（Polish）。
