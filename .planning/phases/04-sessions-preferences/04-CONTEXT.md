# Phase 04: Sessions & Preferences — Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

在已完成的流式聊天和运行透明度表面上，让 WebUI 支持长期使用。具体交付两项能力：
1. 会话列表、恢复与分隔（WEB-06）— 用户可以重新打开之前的会话，会话不会串台
2. 本地偏好和设置持久化（WEB-08）— 用户的基础 UI 偏好和 API key 可以本地保存并恢复

不引入服务端持久化。不做多设备同步。不做用户认证。
</domain>

<decisions>
## Implementation Decisions

### A. 会话存储方式

- **D-01:** 聊天消息和工具调用详情存入 **IndexedDB**。IndexedDB 容量大（通常数百 MB）、支持结构化存储，适合保存完整的消息数组（含 toolCalls、approvalRequest 等嵌套数据）。使用轻量封装（如 `idb` 库或手动封装）而非引入大型 ORM。
- **D-02:** 会话元数据索引（sessionId → title、createdAt、lastActiveAt、model）和用户偏好存入 **localStorage**。这些数据体积极小，localStorage 的同步 API 更方便读取。会话索引用于左侧 sidebar 的会话列表渲染。
- **D-03:** 服务端 session 仍然是**纯内存**（registry.ts 的 Map 不变）。IndexedDB 只在前端做持久化，恢复时从 IndexedDB 读取历史消息渲染到 UI，服务端 session 在首次 chat 时按需重建。

### B. 会话列表交互

- **D-04:** 会话列表**嵌入左侧 sidebar**，替换当前 Session 信息区。列表紧凑显示：会话标题（取首条用户消息前 30 字符）+ 相对时间（如"3 分钟前"）。当前活动会话高亮。
- **D-05:** sidebar 顶部新增 **"新建会话"** 按钮（`+` 图标 + 文字）。点击后清空聊天区，创建新 session，旧 session 自动保存到 IndexedDB。
- **D-06:** 点击历史会话 → 从 IndexedDB 加载消息渲染到聊天区 → 在服务端创建新 session（或复用已有 session）。不尝试恢复服务端运行时状态（abortController、pendingApproval 等是瞬态的）。

### C. 偏好设置范围

- **D-07:** 持久化以下偏好到 localStorage：
  - **模型选择** — 记住上次使用的 model，新建会话时自动使用
  - **API keys** — 各 provider 的 API key（Phase 03 推迟项）。密钥存 localStorage（v1 本地优先，无公网暴露面）
  - **主题** — 暗色/亮色模式切换
- **D-08:** 偏好设置入口放在 sidebar 底部，用 **Popover 或小型设置面板** 展示。不建独立设置页面。设置项保持精简（模型 + API keys + 主题），不做过度设计。
- **D-09:** API key 输入使用 `<input type="password">`，存储时直接明文存 localStorage（v1 本地单用户，不需要加密）。每个 provider 一个 key 输入框。

### D. 会话恢复粒度

- **D-10:** 恢复会话时恢复以下内容：
  - **聊天消息** — user/assistant 消息的 id、role、content、status
  - **工具调用** — toolCalls 数组（tool、status、args、result、error、duration）
  - **审批状态** — 已完成的审批结果（approved/denied），不恢复 pending 状态
- **D-11:** 不恢复以下瞬态：
  - streaming 状态（恢复后所有消息显示为 complete）
  - thinking/thinkingMessage（瞬态 UI 状态）
  - pending 的审批请求（运行时已结束，无法交互）
  - error 状态（历史错误不重现）
- **D-12:** 恢复后的会话可以**继续对话** — 用户发送新消息时，前端从 IndexedDB 读取的历史消息作为上下文展示，新消息正常走 SSE 流。服务端 session 是新建的，历史通过 InMemoryChatHistory 的 saveUserQuery/saveAnswer 预填充，或者前端只做展示层恢复不注入服务端历史（Claude's Discretion，planner 根据复杂度选择）。

### Claude's Discretion

- IndexedDB 的具体 schema 设计（store 名称、索引、版本管理）
- localStorage 的 key 命名约定
- 会话列表的滚动和虚拟化（如果会话数量多的话）
- 设置面板的具体布局和交互细节
- 会话标题的生成方式（首条消息截取 vs LLM 生成摘要）
- IndexedDB 数据的清理策略（最大会话数、过期清理）
- API key 验证逻辑（是否在输入时测试 key 有效性）
- 主题切换的 CSS 实现方式（CSS 变量 + class 切换）
- 前端状态管理中"从 IndexedDB 恢复"和"实时 SSE 更新"的合并逻辑
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### WebUI 运行时（Phase 1-3 已建）
- `src/webui/runtime/types.ts` — WebRuntimeSession、WebRuntimeAgentConfig、StreamableAgentEvent
- `src/webui/runtime/adapter.ts` — runWebSession() 适配器
- `src/webui/runtime/session.ts` — createWebRuntimeSession() 会话工厂
- `src/webui/runtime/registry.ts` — Session 注册表（Map<sessionId, WebRuntimeSession>）

### 前端组件（Phase 1-3 已建）
- `src/components/workspace-shell.tsx` — 主布局 shell，sidebar + 聊天区
- `src/components/chat-message.tsx` — 消息渲染组件（含 ToolCallInfo Badge）
- `src/components/chat-input.tsx` — 聊天输入组件
- `src/components/model-selector.tsx` — 模型选择器组件
- `src/hooks/use-chat-session.ts` — 聊天会话 hook（localStorage 存 sessionId）
- `src/hooks/use-sse-stream.ts` — SSE 流消费工具（ChatMessage、ToolCallInfo 类型定义）

### API 端点（Phase 1-3 已建）
- `src/app/api/runtime/sessions/route.ts` — POST 创建 session
- `src/app/api/runtime/sessions/[id]/chat/route.ts` — POST 发起聊天（SSE 流）
- `src/app/api/runtime/sessions/[id]/abort/route.ts` — POST 中止会话
- `src/app/api/runtime/sessions/[id]/approve/route.ts` — POST 审批工具
- `src/app/api/runtime/sessions/[id]/model/route.ts` — PATCH 切换模型

### 数据模型
- `src/utils/in-memory-chat-history.ts` — InMemoryChatHistory（query + answer + summary）
- `src/utils/model.ts` — PROVIDERS 数据、getModelsForProvider()
- `src/agent/types.ts` — AgentEvent 全部类型定义

### UI 基础
- `src/components/ui/` — shadcn/ui 组件库（Card、Badge、Button、Separator、Popover 等）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **useChatSession hook** (`src/hooks/use-chat-session.ts`): 已有 messages 状态管理、sessionId 的 localStorage 存取、createNewSession、sendQuery 完整流程。Phase 4 需要扩展此 hook 以支持 IndexedDB 读写和会话切换。
- **ChatMessage 类型** (`src/hooks/use-sse-stream.ts`): 已有完整的消息结构（id、role、content、status、toolCalls、thinking、thinkingMessage、approvalRequest），可直接序列化存入 IndexedDB。
- **workspace-shell sidebar** (`src/components/workspace-shell.tsx`): sidebar 已有 Runtime/Model/Session 三个信息区。会话列表将替换 Session 信息区。
- **InMemoryChatHistory** (`src/utils/in-memory-chat-history.ts`): 服务端历史管理，恢复会话时可能需要预填充。

### Established Patterns
- **localStorage key**: `dexter-session-id`（Phase 2 建立）。偏好数据可继续用 `dexter-` 前缀。
- **状态管理**: React useState + useRef，无全局状态库。Phase 4 可能需要提升 session 列表状态到更高层级。
- **组件模式**: shadcn/ui Card + Badge + Button 组合，warm cream + forest green 配色。

### Integration Points
- `useChatSession` 需要新增 `switchSession(sessionId)` 和 `listSessions()` 能力
- `workspace-shell.tsx` 的 sidebar 需要从静态信息区改造为会话列表
- 新增 IndexedDB 初始化和操作封装（`src/lib/db.ts` 或 `src/hooks/use-session-store.ts`）
- 新增偏好存储封装（`src/hooks/use-preferences.ts`）
- API key 需要在创建 session 和切换 model 时传入（可能需要扩展 POST /sessions 和 PATCH /model 的请求体）
- 可能需要新增 API 端点用于验证 API key 有效性
</code_context>

<specifics>
## Specific Ideas

- 会话列表参考 ChatGPT 左侧栏的交互模式：紧凑列表 + 新建按钮 + 点击切换
- IndexedDB 封装参考 `idb` 库的 Promise 化 API 风格，但可以直接手写封装以避免引入新依赖
- 主题切换用 CSS 变量 + `data-theme` attribute，shadcn/ui 原生支持 dark mode
- API key 输入放在设置面板中，每个 provider 一行，和模型选择器中的 provider 列表对应

## Deferred Ideas

- **会话搜索** — 搜索历史会话内容。推迟到 Phase 5 或后续。
- **会话导出** — 导出聊天记录为 Markdown/JSON。推迟到 Phase 5。
- **会话标签/分类** — 给会话打标签或分文件夹。推迟到 v2。
- **多设备同步** — 需要 Cloud Sync 后端，v2 范围。
- **加密存储** — API key 加密存储。v1 本地单用户不需要，v2 如果上公网再考虑。
</deferred>

---

*Phase: 04-sessions-preferences*
*Context gathered: 2026-05-05*
