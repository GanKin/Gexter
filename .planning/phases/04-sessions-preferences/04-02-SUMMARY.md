---
phase: 04
plan: 02
title: 本地偏好和设置持久化
status: complete
tags: [webui, preferences, theme, api-keys]

key-files:
  created:
    - src/lib/preferences.ts
    - src/lib/preferences.test.ts
    - src/hooks/use-theme.ts
    - src/components/settings-panel.tsx
  modified:
    - src/hooks/use-chat-session.ts
    - src/components/model-selector.tsx
    - src/components/workspace-shell.tsx
    - src/app/layout.tsx
    - src/app/globals.css
    - src/app/api/runtime/sessions/route.ts
    - src/model/llm.ts
    - src/agent/agent.ts
    - src/agent/types.ts

requirements-completed: [WEB-08]
---

# Phase 04-02 Summary

实现了模型、API key 和主题偏好的本地持久化，让 WebUI 刷新后能够恢复上次选择，并在新会话中继续使用这些偏好。

## Accomplishments
- 新增 `preferences` 封装，统一管理模型、provider、主题和各 provider API key。
- 新增 `useTheme` hook，并在 `layout.tsx` 中注入首屏主题脚本，避免暗色模式闪烁。
- 新增 sidebar 底部 `SettingsPanel`，支持主题切换、API key 输入和自动保存。
- 修改 model selector，在没有保存 API key 时给出明确提示。
- 扩展 runtime / LLM 链路，支持从 WebUI 传入 API key 并在创建 session 时使用。

## Validation
- `bun run typecheck`
- `bun test`

## Self-Check
- PASSED

