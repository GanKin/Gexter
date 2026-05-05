---
phase: 04
slug: sessions-preferences
status: draft
created: 2026-05-05
---

# Phase 04 — Verification

## HUMAN-UAT

### 1. 会话列表显示与切换
**expected:** Sidebar 显示历史会话列表，点击切换后消息不串台
**result:** [pending]

### 2. 刷新恢复
**expected:** 发送消息后刷新页面，会话列表仍然显示，点击可恢复消息内容（含工具调用详情）
**result:** [pending]

### 3. 新建与删除会话
**expected:** 新建会话清空聊天区，删除会话从列表移除，其他会话不受影响
**result:** [pending]

### 4. 模型选择持久化
**expected:** 切换模型后刷新页面，模型选择保持不变，新建会话使用上次选择的模型
**result:** [pending]

### 5. API Key 存储
**expected:** 输入 API key 后刷新页面，key 保留，创建新会话时 key 随请求发送
**result:** [pending]

### 6. 主题切换
**expected:** 切换暗色/亮色模式后页面样式正确变化，刷新后保持选择
**result:** [pending]

### 7. 设置面板交互
**expected:** 展开/收起设置面板正常，所有设置项可操作且自动保存
**result:** [pending]
