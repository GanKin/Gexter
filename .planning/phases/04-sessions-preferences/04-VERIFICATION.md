---
phase: 04
slug: sessions-preferences
created: 2026-05-05
---

# Phase 04 — Verification Checklist

## Pre-Implementation
- [ ] 04-CONTEXT.md 已读取
- [ ] 所有 canonical refs 已读取

## Plan 04-01: 会话列表、恢复与分隔

### Task 1: IndexedDB 存储层
- [ ] `src/lib/session-store.ts` 创建完成
- [ ] IndexedDB schema: sessions + messages 两个 store
- [ ] 序列化/反序列化 toolCalls 和 approvalRequest
- [ ] 瞬态清除逻辑（status/thinking/approval）
- [ ] 清理策略（50 会话上限）
- [ ] `bun test src/lib/session-store.test.ts` 通过

### Task 2: localStorage 索引
- [ ] `src/lib/session-index.ts` 创建完成
- [ ] 索引增删改查 API
- [ ] activeSessionId 管理

### Task 3: useChatSession 改造
- [ ] 新增 sessionList 状态
- [ ] switchSession() 实现
- [ ] startNewSession() 实现
- [ ] deleteSessionById() 实现
- [ ] sendQuery 后同步到 IndexedDB
- [ ] 初始化时加载会话列表

### Task 4: SessionList 组件
- [ ] `src/components/session-list.tsx` 创建
- [ ] 列表渲染：标题 + 时间
- [ ] 活动会话高亮
- [ ] 新建按钮
- [ ] 删除交互

### Task 5: Sidebar 集成
- [ ] workspace-shell sidebar 改造
- [ ] 场景 A: 新建切换不串台
- [ ] 场景 B: 刷新恢复
- [ ] 场景 C: 多会话分隔
- [ ] 场景 D: 删除会话

## Plan 04-02: 本地偏好和设置持久化

### Task 1: 偏好存储封装
- [ ] `src/lib/preferences.ts` 创建完成
- [ ] localStorage 结构定义
- [ ] loadPreferences / savePreference API
- [ ] API key 管理 API

### Task 2: API Key + 模型选择器对接
- [ ] model-selector 检查 API key 提示
- [ ] POST /sessions 传递 apiKey
- [ ] 服务端接收 apiKey
- [ ] changeModel 持久化到 preferences

### Task 3: 主题切换
- [ ] `src/hooks/use-theme.ts` 创建
- [ ] 暗色模式 CSS 变量
- [ ] system 主题监听
- [ ] 防闪烁初始化

### Task 4: 设置面板
- [ ] `src/components/settings-panel.tsx` 创建
- [ ] 主题切换 UI
- [ ] API key 输入 UI
- [ ] Sidebar 底部集成
- [ ] 自动保存（debounce）

## Final Checks
- [ ] `bun run typecheck` 通过
- [ ] `bun test` 通过
- [ ] HUMAN-UAT 7 项全部验证
