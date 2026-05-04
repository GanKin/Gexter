# Phase 03: Run Transparency — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 03-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 03-run-transparency
**Areas discussed:** 工具审批交互, 运行控制, 工具详情展示, 模型/Provider选择器

---

## 工具审批交互

### 审批 UI 呈现方式

| Option | Description | Selected |
|--------|-------------|----------|
| 内联卡片 | 在聊天流中插入特殊卡片，工具名+参数+三按钮，流式暂停 | ✓ |
| 底部固定栏 | 类似浏览器权限请求，底部固定审批栏 | |
| 模态弹窗 | 居中对话框，强制处理 | |

**User's choice:** 内联卡片
**Notes:** 和现有 ChatMessage 卡片风格一致，不跳出对话上下文

### 审批卡片信息密度

| Option | Description | Selected |
|--------|-------------|----------|
| 紧凑 | 工具名 + 一行参数摘要 + 三个按钮 | ✓ |
| 详细 | 工具名 + 完整参数(可折叠JSON) + 风险提示 | |
| 极简 | 只显示工具名和允许/拒绝 | |

**User's choice:** 紧凑

### SSE 接入方式

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展现有 SSE 流 | 同一SSE连接推送审批事件 + POST /approve接收决策 | ✓ |
| 双向 SSE | WebSocket或双通道SSE | |
| 轮询 | 服务端缓存审批请求，前端轮询 | |

**User's choice:** 扩展现有 SSE 流

---

## 运行控制

### 停止按钮位置

| Option | Description | Selected |
|--------|-------------|----------|
| 替换发送按钮 | 流式中发送按钮变红色停止按钮 | ✓ |
| 聊天区顶部浮动 | 消息区顶部浮动停止栏 | |
| 侧边栏状态区 | sidebar session 信息区添加 | |

**User's choice:** 替换发送按钮

### 停止后行为

| Option | Description | Selected |
|--------|-------------|----------|
| 保留内容，允许重发 | 保留已生成文本，标记aborted，恢复发送按钮 | ✓ |
| 清空重试 | 清空当前assistant消息 | |
| 仅允许新消息 | 保留内容但不可重试 | |

**User's choice:** 保留内容，允许重发

### Abort 服务端实现

| Option | Description | Selected |
|--------|-------------|----------|
| POST /abort 端点 | 新建abort端点，session registry保存AbortController引用 | ✓ |
| 关闭 SSE 连接 | 浏览器中断fetch检测 | |
| SSE 发送 abort | 不适用于单向SSE | |

**User's choice:** POST /abort 端点

---

## 工具调用详情展示

### 展开/折叠交互

| Option | Description | Selected |
|--------|-------------|----------|
| 默认折叠，点击展开 | Badge显示工具名+状态，点击展开详情 | ✓ |
| 默认展开 | 每个工具直接显示完整信息 | |
| 独立工具面板 | 右侧/侧边栏工具时间线 | |

**User's choice:** 默认折叠，点击展开

### 返回值展示格式

| Option | Description | Selected |
|--------|-------------|----------|
| 截断预览+滚动 | 前200字符，固定高度滚动 | ✓ (recommended default) |
| 完整展示+高亮 | 自动检测JSON并语法高亮 | |
| 仅摘要 | "返回1.2KB数据" | |

**User's choice:** 截断预览+滚动（推荐默认）
**Notes:** 用户提到 ChatUI 作为参考，经讨论后推迟到 Phase 5

### 错误展示

| Option | Description | Selected |
|--------|-------------|----------|
| 红色错误卡片 | 可折叠红色调错误区域 | ✓ |
| 内联红色文本 | Badge旁显示红色错误消息 | |
| 和正常结果一样 | 不做特殊处理 | |

**User's choice:** 红色错误卡片

---

## 模型/Provider 选择器

### 选择器位置

| Option | Description | Selected |
|--------|-------------|----------|
| 侧边栏替换 Model 区 | 左侧sidebar就地升级为交互式选择器 | ✓ |
| 聊天区顶部工具栏 | 聊天卡片顶部下拉 | |
| 设置弹窗 | 点击设置图标弹出面板 | |

**User's choice:** 侧边栏替换 Model 区

### 切换模型时 session 处理

| Option | Description | Selected |
|--------|-------------|----------|
| 不需要重建 | 更新model字段，下次chat用新模型 | ✓ |
| 新建 session | 旧会话保留但不再继续 | |
| 需要确认 | 弹出确认框让用户选择 | |

**User's choice:** 不需要重建

### Provider 暴露程度

| Option | Description | Selected |
|--------|-------------|----------|
| 暴露两级选择 | 先选provider再选model，和CLI一致 | ✓ (recommended default) |
| 只暴露 model 列表 | 不区分provider平铺列表 | |
| 只显示当前模型 | 不提供切换，推迟选择器 | |

**User's choice:** 暴露两级选择（推荐默认）
**Notes:** API key 管理留到 Phase 4

---

## Claude's Discretion

- 审批卡片的具体动画和过渡效果
- 停止按钮的具体图标和 hover 状态
- 工具调用展开/折叠的过渡动画
- 模型选择器的下拉样式细节
- 错误卡片的具体布局
- ToolCallInfo 类型扩展的字段命名

## Deferred Ideas

- ChatUI 引入 — 推迟到 Phase 5 或专门重构阶段
- JSON 语法高亮 — 推迟到 Phase 5
- API key 管理 UI — 推迟到 Phase 4
