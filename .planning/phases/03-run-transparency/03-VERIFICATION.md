---
phase: 03-run-transparency
verified: 2026-05-04T14:20:08Z
status: human_needed
score: 15/15 must-haves verified
human_verification:
  - test: "在浏览器里触发一次普通工具调用，点击工具条目的详情控制，检查参数、返回值预览和耗时是否可展开展示。"
    expected: "工具详情面板展开/收起正常，参数、返回值和耗时都可见，错误调用显示红色样式。"
    why_human: "这是实际 UI 交互和视觉呈现，无法仅靠静态检查完全确认。"
  - test: "在浏览器里触发一次需要审批的敏感工具调用，点击允许/本次会话允许/拒绝。"
    expected: "审批卡片出现在聊天流中，按钮可用，决策后卡片更新为已批准或已拒绝，运行继续或终止符合预期。"
    why_human: "需要验证真实流式状态变化和用户交互反馈。"
  - test: "在浏览器里进行一次流式运行时点击 Stop，然后继续发送新消息并切换模型。"
    expected: "Stop 按钮终止当前运行，消息标记为已中止，输入区恢复，模型切换后下一次请求使用新模型。"
    why_human: "这是端到端用户流程和实时行为，不能只靠代码路径证明。"
---

# Phase 03: Run Transparency Verification Report

**Phase Goal:** Build the WebUI transparency layer for runtime operations: tool-call details, approval flow, abort/stop flow, and model switching.
**Verified:** 2026-05-04T14:20:08Z
**Status:** human_needed
**Re-verification:** No — initial verification

## 目标达成情况

### 可观察真相

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `WEB-04`: 用户能在运行中看到工具调用、审批状态和中间态。 | ✓ VERIFIED | `STREAMABLE_EVENT_TYPES` 已包含 `tool_approval` / `tool_denied`，`use-chat-session` 会写入 `approvalRequest` 和 `ToolCallInfo`，`chat-message` 会渲染工具详情与审批卡片。 |
| 2 | `WEB-05`: 用户能在 WebUI 中停止进行中的运行，并继续下一轮对话。 | ✓ VERIFIED | `abortSession` 调用 `/abort`，服务端创建并挂载 `AbortController`，`runWebSession` 在 `AbortError` 时把会话状态设为 `aborted`，输入区会恢复。 |
| 3 | `WEB-07`: 用户能在 WebUI 中选择当前会话使用的模型/Provider。 | ✓ VERIFIED | `ModelSelector` 提供 provider/model 两级选择，`PATCH /model` 更新 `session.model`，`chat` 路由把 `session.model` 传入 `runWebSession`。 |

**Score:** 3/3 requirement IDs verified

### 计划级别检查

#### 03-01: 渲染工具调用详情和审批流

结论: 已满足。

- `ToolCallInfo` 增加了 `duration` 和 `startTime`，`ApprovalRequest` 已导出，`ChatMessage` 含 `approvalRequest` 字段。[src/hooks/use-sse-stream.ts](/Users/gankin/Documents/Gexter/src/hooks/use-sse-stream.ts#L5)
- `runWebSession` 创建 `AbortController`，把 `session.approvedTools` 和 `signal` 传给 `Agent.create`，并在 `requestToolApproval` 中写入 `session.pendingApproval`。[src/webui/runtime/adapter.ts](/Users/gankin/Documents/Gexter/src/webui/runtime/adapter.ts#L5)
- `POST /api/runtime/sessions/:id/approve` 存在，能校验 `requestId`，执行 `resolve(decision)`，并在 `allow-session` 时写入 `approvedTools`。[src/app/api/runtime/sessions/[id]/approve/route.ts](/Users/gankin/Documents/Gexter/src/app/api/runtime/sessions/[id]/approve/route.ts#L13)
- SSE 侧只透出可流式事件，包含 `tool_approval` 和 `tool_denied`。[src/app/api/runtime/sessions/[id]/chat/route.ts](/Users/gankin/Documents/Gexter/src/app/api/runtime/sessions/[id]/chat/route.ts#L22)
- `chat-message` 已实现工具详情、审批卡片和中止标记的渲染。[src/components/chat-message.tsx](/Users/gankin/Documents/Gexter/src/components/chat-message.tsx#L64)

#### 03-02: 停止、重试与继续控制

结论: 已满足。

- `abortSession` 调用 `/abort`，并且只在流式进行中触发。[src/hooks/use-chat-session.ts](/Users/gankin/Documents/Gexter/src/hooks/use-chat-session.ts#L263)
- `POST /api/runtime/sessions/:id/abort` 存在，能找到 session 后调用 `session.abortController.abort()`。[src/app/api/runtime/sessions/[id]/abort/route.ts](/Users/gankin/Documents/Gexter/src/app/api/runtime/sessions/[id]/abort/route.ts#L11)
- `runWebSession` 在 `AbortError` 时返回 `aborted`，并在 `finally` 清理 pending approval 和 abort controller。[src/webui/runtime/adapter.ts](/Users/gankin/Documents/Gexter/src/webui/runtime/adapter.ts#L71)
- `onComplete` 会把未完成的 assistant 消息收尾为 `aborted`，保证内容保留。[src/hooks/use-chat-session.ts](/Users/gankin/Documents/Gexter/src/hooks/use-chat-session.ts#L490)
- `ChatInput` 在 streaming 时切换成红色 Stop 按钮，点击后清空输入并调用 `onAbort`。[src/components/chat-input.tsx](/Users/gankin/Documents/Gexter/src/components/chat-input.tsx#L35)

#### 03-03: 模型/Provider 选择器

结论: 已满足。

- `ModelSelector` 文件存在，接收 `currentModel` 和 `onModelChange`，关闭态展示当前模型，打开后可在 provider 和 model 两级之间切换。[src/components/model-selector.tsx](/Users/gankin/Documents/Gexter/src/components/model-selector.tsx#L12)
- Provider 列表固定为 6 个：openai、anthropic、google、xai、moonshot、deepseek。[src/components/model-selector.tsx](/Users/gankin/Documents/Gexter/src/components/model-selector.tsx#L17)
- `PATCH /api/runtime/sessions/:id/model` 会校验 provider/model 组合并更新 `session.model` 和 chat history model。[src/app/api/runtime/sessions/[id]/model/route.ts](/Users/gankin/Documents/Gexter/src/app/api/runtime/sessions/[id]/model/route.ts#L12)
- `chat` 路由把 `session.model` 传入 `runWebSession`，下一轮请求会使用新模型。[src/app/api/runtime/sessions/[id]/chat/route.ts](/Users/gankin/Documents/Gexter/src/app/api/runtime/sessions/[id]/chat/route.ts#L55)
- `WorkspaceShell` 已把 `ModelSelector`、`approveTool` 和 `abortSession` 串到侧边栏和聊天区。[src/components/workspace-shell.tsx](/Users/gankin/Documents/Gexter/src/components/workspace-shell.tsx#L21)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/webui/runtime/types.ts` | Web 会话、事件集合、审批状态扩展 | ✓ VERIFIED | `pendingApproval`、`abortController`、`STREAMABLE_EVENT_TYPES` 都已存在。 |
| `src/webui/runtime/adapter.ts` | 运行时桥接审批与中止控制 | ✓ VERIFIED | `requestToolApproval`、`AbortController`、`session.status='aborted'` 均已实现。 |
| `src/webui/runtime/session.ts` | 新建 session 时初始化透明层状态 | ✓ VERIFIED | `approvedTools`、`pendingApproval`、`status` 都被初始化。 |
| `src/app/api/runtime/sessions/[id]/chat/route.ts` | SSE 聊天路由 | ✓ VERIFIED | 只转发可流式事件，并把 `session.model` 传入运行时。 |
| `src/app/api/runtime/sessions/[id]/approve/route.ts` | 审批回调端点 | ✓ VERIFIED | requestId 校验、decision 校验、resolve、session-approved 工具持久化都存在。 |
| `src/app/api/runtime/sessions/[id]/abort/route.ts` | 停止运行端点 | ✓ VERIFIED | 能 abort 当前运行并返回 `aborted`。 |
| `src/app/api/runtime/sessions/[id]/model/route.ts` | 模型切换端点 | ✓ VERIFIED | 能验证 provider/model 组合并更新 session。 |
| `src/hooks/use-sse-stream.ts` | 前端消息/工具/审批数据模型 | ✓ VERIFIED | 增强字段已导出，支持审批和工具耗时展示。 |
| `src/hooks/use-chat-session.ts` | 事件处理、审批、停止、模型切换 | ✓ VERIFIED | `approveTool`、`abortSession`、`changeModel` 和事件分支都已接好。 |
| `src/components/chat-message.tsx` | 工具详情、审批卡片、中止标记 | ✓ VERIFIED | UI 结构完整，可展示参数、返回值、耗时和审批结果。 |
| `src/components/chat-input.tsx` | Stop 按钮交互 | ✓ VERIFIED | streaming 时切换为 Stop，点击后调用 abort。 |
| `src/components/workspace-shell.tsx` | 侧边栏集成 | ✓ VERIFIED | `ModelSelector` 与聊天区组件已接入。 |
| `src/components/model-selector.tsx` | provider/model 两级选择器 | ✓ VERIFIED | 可展开、可返回、可切换。 |
| `src/utils/model.ts` | provider/model 列表与校验 | ✓ VERIFIED | 6 个 provider 的 model 列表与校验函数可用。 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/app/api/runtime/sessions/[id]/chat/route.ts` | `src/webui/runtime/adapter.ts` | `runWebSession(..., { config: { model: session.model } })` | ✓ WIRED | 当前 session.model 会进入 Agent.create。 |
| `src/webui/runtime/adapter.ts` | `src/app/api/runtime/sessions/[id]/approve/route.ts` | `session.pendingApproval.resolve(decision)` | ✓ WIRED | 审批 Promise 可由 POST /approve 解除阻塞。 |
| `src/hooks/use-chat-session.ts` | `src/app/api/runtime/sessions/[id]/approve/route.ts` / `abort/route.ts` / `model/route.ts` | `fetch(...)` | ✓ WIRED | 前端已连接三个会话控制端点。 |
| `src/components/workspace-shell.tsx` | `src/components/model-selector.tsx` | props 传递 `currentModel` / `onModelChange` | ✓ WIRED | 侧边栏模型选择器可直接驱动会话模型切换。 |
| `src/components/workspace-shell.tsx` | `src/components/chat-message.tsx` / `src/components/chat-input.tsx` | props 传递 `approveTool` / `abortSession` / `isStreaming` | ✓ WIRED | 聊天区、审批和停止按钮已形成闭环。 |
| `src/agent/tool-executor.ts` | `src/webui/runtime/adapter.ts` / `src/hooks/use-chat-session.ts` | `tool_approval` / `tool_denied` 事件 | ✓ WIRED | 敏感工具审批事件会进入 WebUI 流。 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/components/model-selector.tsx` | `currentModel` | `/api/runtime/health`、`PATCH /model`、`session.model` | Yes | ✓ FLOWING |
| `src/components/chat-message.tsx` | `toolCalls` / `approvalRequest` | SSE 事件流中的 `tool_start` / `tool_end` / `tool_approval` / `tool_denied` | Yes | ✓ FLOWING |
| `src/hooks/use-chat-session.ts` | `status` / `isStreaming` / `messages` | `consumeSSEStream` 回调和 `/abort` 结果 | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 类型检查通过 | `bun run typecheck` | `tsc --noEmit` 通过，无新增错误 | ✓ PASS |
| 相关测试通过 | `bun test src/webui/sse-chat.test.ts src/webui/runtime-adapter.test.ts` | 9/9 tests passed | ✓ PASS |
| 模型切换路由可用 | 直接调用 `PATCH /api/runtime/sessions/:id/model` | 返回 `200`，`session.model` 更新为 `gpt-4.1` | ✓ PASS |
| 审批路由可用 | 直接调用 `POST /api/runtime/sessions/:id/approve` | 返回 `200`，`allow-session` 会写入 `approvedTools` | ✓ PASS |
| 中止路由可用 | 直接调用 `POST /api/runtime/sessions/:id/abort` | 返回 `200`，会话状态变为 `aborted` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `WEB-04` | `03-01` | 用户能看到工具调用、审批和中间态。 | ✓ SATISFIED | SSE 事件类型已扩展，前端能展示工具详情、审批卡片与结果状态。 |
| `WEB-05` | `03-02` | 用户能停止、重试或继续进行中的运行。 | ✓ SATISFIED | `/abort`、AbortController、`aborted` 收尾和 Stop 按钮都已接通。 |
| `WEB-07` | `03-03` | 用户能在 WebUI 里选择当前会话模型/Provider。 | ✓ SATISFIED | `ModelSelector`、`/model` 路由和 `session.model` 下发都已实现。 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| 无 | 无 | 未发现阻塞性 stub、TODO、空实现或硬编码空数据流。 | Info | 当前改动文件看起来是完整实现，不是占位壳。 |

### Human Verification Required

1. **工具详情展开**
   - Test: 在浏览器里触发一次工具调用并展开详情。
   - Expected: 参数、返回值预览和耗时清晰可见，错误状态使用红色样式。
   - Why human: 需要实际浏览器 UI 交互与视觉确认。
2. **审批闭环**
   - Test: 在浏览器里触发一次 write/edit 类工具审批，分别点允许、本次会话允许、拒绝。
   - Expected: 审批卡片出现并更新，运行继续或终止符合预期。
   - Why human: 需要验证实时流式行为和按钮点击反馈。
3. **停止与模型切换**
   - Test: 流式运行中点击 Stop，再切换模型并发送新消息。
   - Expected: 当前 run 变为已中止，输入恢复，下一轮请求使用新模型。
   - Why human: 这是端到端用户流程，不能只靠静态检查完全证明。

### Gaps Summary

代码层面没有发现阻塞性缺口。三项 phase requirement 已全部落地，计划中的 15 个 must-have 也都能在代码中找到对应实现和连线。剩余的只有浏览器里对交互细节、视觉状态和实时行为的人工确认。

---

_Verified: 2026-05-04T14:20:08Z_
_Verifier: Claude (gsd-verifier)_
