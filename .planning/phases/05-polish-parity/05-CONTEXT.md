---
phase: 05
title: Polish & Parity
status: context-gathered
created: 2026-05-05
---

# Phase 05 Context: Polish & Parity

## 目标

把 Dexter WebUI 从"功能完整"打磨到"体验顺手"，确保桌面和移动端都能正常使用，主要聊天路径可以纯键盘操作，并为关键链路建立回归保护。

## 当前状态

- Phase 1-4 代码已全部实现并提交
- 核心组件：`workspace-shell`（双栏布局）、`chat-input`、`chat-message`（含工具详情/审批卡片）、`session-list`、`settings-panel`、`model-selector`
- 已有测试：`session-store.test`、`session-index.test`、`preferences.test`、`sse-chat.test`
- 暗色/亮色主题已支持（`use-theme` + layout 首屏脚本）
- Phase 03 有 3 项浏览器人工验收待完成（合并到本阶段）

## 已确认的决策

### 05-01: 响应式布局 + 视觉打磨

**响应式（移动端适配）：**
- 采用抽屉式侧边栏方案
- `<1024px`（`lg` 断点以下）默认全屏聊天区，左上角 hamburger 按钮触发侧边栏滑出
- 侧边栏用 `translate-x` + 半透明 backdrop 遮罩实现
- `>=1024px` 保持现有双栏布局不变
- 在 `workspace-shell` 中加 `isSidebarOpen` 状态管理

**视觉打磨（3 个具体问题）：**
1. **流式消息跳动** — `bottomRef.scrollIntoView` 每次更新都触发，改为"仅在用户已处于底部时自动滚动"，加 `isNearBottom` 检测（滚动位置距底部 < 150px 视为在底部）
2. **工具详情展开无过渡** — `expanded` 状态切换时内容突然出现/消失，加 `transition` + `overflow-hidden` 做高度过渡动画（200ms）
3. **暗色模式对比度** — `--muted-foreground` 在 `.dark` 中为 `215 10% 70%`，长文本偏灰；调高对比度或给长文本区域用 `--foreground`；`<pre>` 的 `max-h` 从 120px 放大到 200px

**涉及文件：**
- `src/components/workspace-shell.tsx` — 响应式状态 + 移动端侧边栏
- `src/components/chat-message.tsx` — 工具详情过渡、暗色对比度
- `src/app/globals.css` — 暗色模式变量微调
- `src/hooks/use-chat-session.ts` — 无需改动

### 05-02: 键盘快捷键 + 可达性

**快捷键：**
| 快捷键 | 动作 |
|--------|------|
| `Cmd/Ctrl + K` | 聚焦输入框 |
| `Cmd/Ctrl + N` | 新建会话 |
| `Cmd/Ctrl + [` | 上一个会话 |
| `Cmd/Ctrl + ]` | 下一个会话 |
| `Escape` | 关闭展开的详情/设置/侧边栏 |
| `Enter` | 发送（已有） |
| `Shift + Enter` | 换行（已有） |

**实现方式：**
- 新建 `src/hooks/use-keyboard-shortcuts.ts`
- 全局 `useEffect` 监听 `keydown`，根据 `event.key` + `event.metaKey/ctrlKey` 分发
- 不引入外部快捷键库，逻辑简单不值得加依赖
- `workspace-shell` 中调用，把动作通过 props 回调传入

**可达性补充：**
- 移动端 hamburger 按钮加 `aria-label`
- 侧边栏加 `role="dialog"` + `aria-modal="true"`
- 快捷键触发后给目标元素加可见的 focus ring

**涉及文件：**
- `src/hooks/use-keyboard-shortcuts.ts`（新建）
- `src/components/workspace-shell.tsx` — 集成快捷键 + aria 属性
- `src/components/chat-input.tsx` — ref 暴露给快捷键聚焦
- `src/components/chat-message.tsx` — Escape 关闭工具详情

### 05-03: 回归测试 + Phase 03 验收

**核心链路集成测试（必须有）：**
- `POST /api/runtime/sessions` → 创建会话返回 sessionId
- `POST /api/runtime/sessions/:id/chat` → SSE 流式返回正确事件序列
- `POST /api/runtime/sessions/:id/approve` → 审批流程闭环
- `POST /api/runtime/sessions/:id/abort` → 中止生效
- 会话切换后历史不串台（多 session 隔离）

**轻量 E2E（选做但价值高）：**
- Playwright 冒烟测试：打开页面 → 输入消息 → 等到回复 → 切换会话
- 不追求覆盖率，只验证关键路径不断

**Phase 03 人工验收（合并进来）：**
1. 浏览器触发工具调用并展开详情 — 确认参数、返回值、耗时可见
2. 浏览器触发审批调用并操作卡片 — 确认三个按钮在流式场景中工作
3. 浏览器点击 Stop 并切换模型 — 确认中止标记和下一轮模型更新

**涉及文件：**
- `src/__tests__/api-sessions.test.ts`（新建 — 集成测试）
- `src/__tests__/api-chat-stream.test.ts`（新建 — SSE 流式测试）
- `src/__tests__/api-approve-abort.test.ts`（新建 — 审批/中止测试）
- `e2e/smoke.spec.ts`（新建 — Playwright 冒烟，选做）
- 回归测试跑通后，删除 `.planning/HANDOFF.json`

## 约束

- 不引入新的 UI 框架或组件库（保持 shadcn/ui + Tailwind）
- 不改动 Dexter 核心引擎的代码（只改 WebUI 层）
- 快捷键在 macOS 上用 `Cmd`，其他平台用 `Ctrl`
- E2E 测试需要 mock SSE 响应，不依赖真实 LLM 调用

## 技术上下文

- Tailwind 已配置 `lg:` 断点（1024px），可直接使用
- `workspace-shell` 当前用 `lg:grid-cols-[320px_minmax(0,1fr)]` 实现双栏
- `ChatMessage` 组件已用 `expandedTools` state 管理工具详情展开
- 已有 `useChatSession` hook 管理所有会话操作（新建、切换、删除、发送、审批、中止）
- 已有 `useTheme` hook 管理主题
- 项目使用 `bun test` 跑测试，Playwright 如需要需额外安装
