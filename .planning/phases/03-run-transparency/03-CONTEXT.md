# Phase 03: Run Transparency — Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

在已完成的流式聊天表面上，展示 Dexter Agent 的内部活动并提供运行控制。具体交付三项能力：
1. 工具调用详情展示与审批交互（WEB-04）
2. 停止、重试与继续控制（WEB-05）
3. 模型/provider 选择器（WEB-07）

不改动 Agent 核心事件产出逻辑。不引入新的 UI 框架。不涉及会话持久化。
</domain>

<decisions>
## Implementation Decisions

### 工具审批交互

- **D-01:** 审批请求用**内联卡片**呈现，嵌入聊天消息流中，和现有 ChatMessage 卡片风格一致。不使用模态弹窗或底部固定栏。
- **D-02:** 审批卡片**紧凑展示**：工具名 + 一行参数摘要（如 `write_file → "data/report.md"`）+ 三个操作按钮（允许一次 / 本次会话全部允许 / 拒绝）。
- **D-03:** **复用现有 SSE 流**推送 `tool_approval` 事件（表示审批结果）。审批交互通过新增 `POST /api/runtime/sessions/:id/approve` 端点完成。服务端 `runWebSession` 中的 `requestToolApproval` 回调等待该 POST 请求的 Promise resolve。这是"SSE 推送状态 + POST 接收决策"的双端点模式。

### 运行控制

- **D-04:** 流式进行中，底部**发送按钮变为红色停止按钮**。点击触发 abort 信号，当前 assistant 消息标记为"已中止"。
- **D-05:** 停止后**保留已生成的文本**，消息新增 `status: 'aborted'` 状态。底部恢复发送按钮，用户可直接发送新消息或编辑重发。不丢失已有内容。
- **D-06:** 新增 `POST /api/runtime/sessions/:id/abort` 端点。服务端在 `runWebSession` 启动时创建 `AbortController`，通过 session registry 保存引用。浏览器调用 `/abort` 后，服务端调用 `controller.abort()`。

### 工具调用详情展示

- **D-07:** 工具调用**默认折叠**（Badge 只显示工具名 + 状态），点击展开显示：参数摘要、返回值预览、调用耗时。
- **D-08:** 展开后的返回值使用**截断预览**（前 200 字符）+ 固定高度滚动区域。Phase 5 再考虑 JSON 语法高亮。
- **D-09:** 工具调用失败时显示**红色错误卡片**（可折叠），包含错误消息和简短描述。视觉上明显区分正常和错误状态。

### 模型/Provider 选择器

- **D-10:** 选择器放在**左侧 sidebar**，替换当前静态的 Model 信息区。点击展开 provider/model 两级下拉选择。
- **D-11:** 切换模型**不需要重建 session**。只更新 session 的 `model` 字段，下次 chat 调用自动使用新模型。已有会话历史保留。
- **D-12:** **暴露两级选择**：先选 provider（openai、anthropic、google、xai、moonshot、deepseek）再选 model。复用已有 `PROVIDERS` 数据和 `getModelsForProvider()` 工具函数。API key 管理留到 Phase 4。

### Claude's Discretion

- 审批卡片的具体动画和过渡效果
- 停止按钮的具体图标和 hover 状态
- 工具调用展开/折叠的过渡动画
- 模型选择器的下拉样式细节
- 错误卡片的具体布局
- `ToolCallInfo` 类型扩展的字段命名
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent 事件系统
- `src/agent/types.ts` — AgentEvent 全部类型定义，包括 ToolApprovalEvent、ToolDeniedEvent、ApprovalDecision
- `src/agent/tool-executor.ts` — 审批门控逻辑（requiresApproval、requestToolApproval 回调、sessionApprovedTools）
- `src/agent/agent.ts` — Agent.run() AsyncGenerator，事件产出逻辑，AgentConfig 中 signal 和 requestToolApproval 参数

### WebUI 运行时（Phase 1-2 已建）
- `src/webui/runtime/types.ts` — WebRuntimeSession、WebRuntimeAgentConfig、StreamableAgentEvent、PHASE2_EVENT_TYPES
- `src/webui/runtime/adapter.ts` — runWebSession() — 连接 WebUI 和 Agent 的适配器
- `src/webui/runtime/session.ts` — createWebRuntimeSession() 会话工厂
- `src/webui/runtime/registry.ts` — Session 注册表（Map<sessionId, WebRuntimeSession>）
- `src/webui/server/routes.ts` — 现有 HTTP 路由定义

### 前端组件（Phase 2 已建）
- `src/components/workspace-shell.tsx` — 主布局 shell，包含 sidebar 和聊天区
- `src/components/chat-message.tsx` — 消息渲染组件，包含 ToolCallInfo Badge 渲染
- `src/components/chat-input.tsx` — 聊天输入组件
- `src/hooks/use-chat-session.ts` — 聊天会话 hook
- `src/hooks/use-sse-stream.ts` — SSE 流消费工具（ChatMessage、ToolCallInfo 类型定义）

### API 端点（Phase 1-2 已建）
- `src/app/api/runtime/sessions/route.ts` — POST 创建 session
- `src/app/api/runtime/sessions/[id]/chat/route.ts` — POST 发起聊天（SSE 流）

### CLI 参考（复用模式）
- `src/controllers/agent-runner.ts` — CLI 的 AgentRunnerController，已实现 requestToolApproval、cancelExecution、respondToApproval
- `src/controllers/model-selection.ts` — CLI 的 ModelSelectionController，provider/model 选择流程
- `src/utils/model.ts` — PROVIDERS 数据、getModelsForProvider()、Model 类型
- `src/providers.ts` — provider 定义（displayName、id）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **session registry** (`src/webui/runtime/registry.ts`): 已有 Map<sessionId, WebRuntimeSession>，abort 端点可通过它找到对应 session 和 AbortController
- **ToolCallInfo 类型** (`src/hooks/use-sse-stream.ts`): 已有 `tool / status / args / result / error` 字段，可直接扩展
- **ChatMessage 组件** (`src/components/chat-message.tsx`): 已有 Badge 渲染工具状态，可在此基础上加展开/折叠
- **PROVIDERS 数据** (`src/utils/model.ts`): 已有 6 个 provider 的完整 model 列表，可直接用于前端选择器
- **AgentRunnerController** (`src/controllers/agent-runner.ts`): CLI 的审批和 abort 实现可直接参考移植到 WebUI 适配层

### Established Patterns
- **双端点模式**: SSE 推送状态通知 + 独立 POST 接收决策。审批和 abort 都用这个模式。
- **session registry 引用传递**: 通过全局 Map 保存 session 引用，端点处理器可获取 session 状态和控制器
- **事件过滤**: `PHASE2_EVENT_TYPES` 白名单过滤 SSE 推送的事件类型。Phase 3 需要扩展此白名单加入 `tool_approval` 和 `tool_denied`

### Integration Points
- `runWebSession()` 需要增加 `requestToolApproval` 回调和 `AbortController` 的创建/注册
- `PHASE2_EVENT_TYPES` 需要扩展为 Phase 3 的事件白名单
- `WebRuntimeSession` 类型可能需要增加 `abortController` 字段
- `ChatMessage` 的 `ToolCallInfo` 需要增加展开/折叠状态
- sidebar 的 Model 区域需要从静态展示升级为交互式选择器
- `useChatSession` hook 需要支持 abort 和 approve 操作
</code_context>

<specifics>
## Specific Ideas

- 审批卡片参考 CLI 的 `approval-prompt.ts` 组件的交互语义，但用 WebUI 的 Card/Badge 风格重新设计
- 工具调用展开区域的交互参考开发工具的 Network 面板（点击行展开详情）
- 停止按钮的交互参考 ChatGPT 的 "Stop generating" 按钮模式
- 模型选择器参考 CLI 的 `ModelSelectionController` 流程但用下拉菜单代替 CLI 的逐步选择
</specifics>

<deferred>
## Deferred Ideas

- **ChatUI 引入** — 考虑引入阿里 ChatUI (`@chatui/core`) 替换当前 shadcn/ui 聊天层。推迟到 Phase 5 (Polish) 或专门的重构阶段。需要评估与现有 shadcn/ui 布局的兼容性。
- **JSON 语法高亮** — 工具返回值的语法高亮展示。推迟到 Phase 5。
- **API key 管理 UI** — 切换 provider 时需要的 API key 输入/验证界面。推迟到 Phase 4 (Sessions & Preferences)。
</deferred>

---

*Phase: 03-run-transparency*
*Context gathered: 2026-05-04*
