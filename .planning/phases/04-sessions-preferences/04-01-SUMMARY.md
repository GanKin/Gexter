---
phase: 04
plan: 01
title: 会话列表、恢复与分隔
status: complete
tags: [webui, indexeddb, localstorage, sessions]

key-files:
  created:
    - src/lib/session-store.ts
    - src/lib/session-store.test.ts
    - src/lib/session-index.ts
    - src/lib/session-index.test.ts
    - src/components/session-list.tsx
  modified:
    - src/hooks/use-chat-session.ts
    - src/components/workspace-shell.tsx
    - src/app/api/runtime/sessions/route.ts
    - src/webui/runtime/session.ts
    - src/webui/runtime/types.ts
    - src/webui/runtime/adapter.ts
    - src/app/api/runtime/sessions/[id]/chat/route.ts
    - src/app/api/runtime/sessions/[id]/model/route.ts
    - src/utils/in-memory-chat-history.ts

requirements-completed: [WEB-06]
---

# Phase 04-01 Summary

实现了本地会话持久化与恢复链路：会话元数据进入 `localStorage`，消息进入 IndexedDB，侧边栏可以显示历史会话、切换会话、删除会话和新建会话。

## Accomplishments
- 新增 `session-index` 封装，管理会话列表、active session id 和元数据索引。
- 新增 `session-store` 封装，负责消息读写、恢复归一化、消息与会话数量限制。
- 重构 `useChatSession`，支持 session 列表、切换、删除、新建，以及按需重建 runtime session。
- 新增 `SessionList` 组件并集成到 `workspace-shell` 左侧栏。
- 让 web runtime session 在恢复时可重建，并把历史 turn 预填回 `InMemoryChatHistory`，保证续聊不丢上下文。

## Validation
- `bun run typecheck`
- `bun test`

## Self-Check
- PASSED

