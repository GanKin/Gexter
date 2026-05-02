# Roadmap: Dexter WebUI

## Overview

Dexter WebUI 的路线是先把 Dexter 核心当作稳定运行时包起来，再逐步补齐浏览器聊天、流式输出、工具透明度、会话持久化和体验打磨。整个过程强调“加一层”，不是“重写一遍”，因此每一阶段都要验证核心能力仍然可被 CLI 和网关继续使用。

## Phases

- [ ] **Phase 1: Shell & Boundary** - 建立 WebUI 外壳和与现有 Dexter 核心之间的适配边界
- [ ] **Phase 2: Streaming Chat** - 让浏览器可以发起会话并接收流式回答
- [ ] **Phase 3: Run Transparency** - 展示工具调用、审批、运行控制和模型选择
- [ ] **Phase 4: Sessions & Preferences** - 支持会话恢复、历史管理和本地偏好保存
- [ ] **Phase 5: Polish & Parity** - 打磨响应式与键盘体验，并做兼容性回归防护

## Phase Details

### Phase 1: Shell & Boundary

**Goal**: 交付一个可进入的 WebUI 外壳，并把与 Dexter 核心的边界固定下来。
**Depends on**: Nothing
**Requirements**: WEB-01, WEB-02, WEB-09, WEB-10
**Success Criteria** (what must be TRUE):
  1. 用户可以打开一个浏览器页面，并明确看到这是 Dexter WebUI 的入口。
  2. WebUI 能通过一个清晰的适配层接到现有 Dexter 运行时，而不是复制核心逻辑。
  3. CLI 和网关仍然可以按原路径运行，未被 WebUI 改坏。
**Plans**: 3 plans

Plans:
- [ ] 01-01: 搭建 WebUI 应用壳和基础路由
- [ ] 01-02: 定义与现有 Dexter 核心交互的适配边界
- [ ] 01-03: 验证 CLI / Gateway 与新外壳并存

### Phase 2: Streaming Chat

**Goal**: 让用户在网页中像使用 Dexter 一样发起研究会话并看到流式回复。
**Depends on**: Phase 1
**Requirements**: WEB-03
**Success Criteria** (what must be TRUE):
  1. 用户可以在浏览器中提交问题并获得答复。
  2. 回复可以逐步流式呈现，而不是只在最后一次性出现。
  3. 会话状态在一次运行过程中能保持连贯。
**Plans**: 2 plans

Plans:
- [ ] 02-01: 实现网页消息输入与会话启动
- [ ] 02-02: 实现流式输出和中间状态渲染

### Phase 3: Run Transparency

**Goal**: 让 WebUI 清楚展示 Dexter 在做什么，并提供基础运行控制。
**Depends on**: Phase 2
**Requirements**: WEB-04, WEB-05, WEB-07
**Success Criteria** (what must be TRUE):
  1. 用户能看到工具调用、审批和中间步骤。
  2. 用户可以停止、重试或继续正在运行的会话。
  3. 用户可以在会话级别选择模型或 provider。
**Plans**: 3 plans

Plans:
- [ ] 03-01: 渲染工具调用和审批流
- [ ] 03-02: 加入停止、重试与继续控制
- [ ] 03-03: 接入模型 / provider 选择器

### Phase 4: Sessions & Preferences

**Goal**: 让 WebUI 可以长期使用，支持会话恢复和本地个性化设置。
**Depends on**: Phase 3
**Requirements**: WEB-06, WEB-08
**Success Criteria** (what must be TRUE):
  1. 用户可以重新打开之前的会话，并且会话不会串台。
  2. 用户的基础 UI 偏好可以本地保存并恢复。
**Plans**: 2 plans

Plans:
- [ ] 04-01: 会话列表、恢复与分隔
- [ ] 04-02: 本地偏好和设置持久化

### Phase 5: Polish & Parity

**Goal**: 把 WebUI 打磨到桌面和移动浏览器都可用，并确保基本交互足够顺手。
**Depends on**: Phase 4
**Requirements**: WEB-11, WEB-12
**Success Criteria** (what must be TRUE):
  1. 页面在桌面和移动端都能正常工作。
  2. 主要聊天路径可以只用键盘完成。
  3. 关键流程有回归保护，避免破坏 Dexter 的既有入口。
**Plans**: 3 plans

Plans:
- [ ] 05-01: 响应式布局与视觉收口
- [ ] 05-02: 键盘可达性和可用性打磨
- [ ] 05-03: 为 WebUI 和兼容性建立回归测试

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shell & Boundary | 0/3 | Not started | - |
| 2. Streaming Chat | 0/2 | Not started | - |
| 3. Run Transparency | 0/3 | Not started | - |
| 4. Sessions & Preferences | 0/2 | Not started | - |
| 5. Polish & Parity | 0/3 | Not started | - |
