# Dexter WebUI

## What This Is

Dexter WebUI 是一个包在现有 Dexter 之上的浏览器界面，目标是在不改动底层 agent、工具、记忆、cron 和网关能力的前提下，让用户用网页来发起和查看 Dexter 的研究会话。它不是重写 Dexter，而是给 Dexter 加一层更现代、更易用的外壳。

## Core Value

把 Dexter 的现有能力安全地暴露成一个好用的 Web 入口，同时不破坏已经成熟的核心引擎。

## Requirements

### Validated

- ✓ Dexter 现有 CLI / TUI 研究流程已经存在，并且是当前主要交互入口。
- ✓ Dexter 的 WhatsApp 网关、记忆、cron、评测和工具层已经建立，说明核心引擎可以被多种入口复用。
- ✓ 现有代码已经把 agent core 和外层入口分离，适合新增一层 WebUI 而不是重构底层。

### Active

- [ ] 构建一个浏览器可访问的 Dexter WebUI，作为现有运行时的外壳而不是新的核心。
- [ ] 让用户可以从网页里发起会话、发送问题，并看到 Dexter 的流式回答。
- [ ] 在网页中展示工具调用、审批和运行状态，让交互体验接近 Dexter 的真实执行过程。
- [ ] 支持会话列表、会话恢复和本地偏好保存，保证浏览器里也能持续工作。
- [ ] 保持现有 CLI 和网关路径可用，不让 WebUI 取代或破坏现有入口。

### Out of Scope

- 重写 Dexter 的 agent / tool / memory / cron 架构 - 这会扩大风险面，也违背“只包一层”的目标。
- 做成公网多租户 SaaS - v1 目标是本地包裹层，不需要引入复杂的账号、权限和托管后端。
- 为 WebUI 新增一套新的金融能力 - WebUI 的职责是暴露 Dexter 已有能力，而不是扩张它的能力边界。

## Context

这是一个 brownfield 项目，仓库里已经有成熟的 CLI、WhatsApp 网关、LLM 抽象、财务工具、记忆层和 cron 调度。代码库映射显示 Dexter 的核心已经通过清晰边界封装，因此 WebUI 最合理的做法是新增一层界面和适配层，把现有核心能力复用起来，而不是重新搭建一套 agent 系统。

当前最重要的产品方向不是“再做一个 Dexter”，而是“让 Dexter 更容易被使用”。这意味着 UI、会话管理、流式呈现和可视化透明度会是重点，但核心推理逻辑和工具体系应该保持不变。

## Constraints

- **Architecture**: WebUI 必须复用现有 Dexter 核心，不引入第二套 agent / tool / model 体系 - 避免分叉和重复维护。
- **Compatibility**: 现有 CLI 和 WhatsApp 网关必须继续可用 - 这是一个增量外壳，不是迁移工程。
- **Security**: 继续保持本地优先的密钥和运行态管理 - v1 不引入公网暴露面或新的认证边界。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebUI 作为外层包裹而不是核心重写 | 最小化对已稳定能力的扰动，降低回归风险 | — Pending |
| 保留 CLI / Gateway 并行可用 | 避免强制迁移，给用户保留现有工作流 | — Pending |
| v1 先做本地 WebUI | 与现有本地运行时、状态和凭据模型一致 | — Pending |

---
*Last updated: 2026-05-03 after new-project initialization*
