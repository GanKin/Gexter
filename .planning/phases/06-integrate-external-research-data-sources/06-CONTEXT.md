# Phase 06: Integrate external research data sources — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

把研究类问题从现有的 market / financial 路由中拆出来，建立一个可扩展的研究数据层。第一版重点是为 `get_research` 提供路由入口，并为自建数据源 `weknora` 预留子工具边界，覆盖期权、趋势、资金流等数据类型。

这不是 WebUI 交互阶段，不改 UI shell，不改会话持久化。重点是工具编排、路由和数据源接入。
</domain>

<decisions>
## Seeded Scope

- `get_research` 适合作为顶层 meta-tool，负责把自然语言研究问题路由到更具体的子工具。
- `weknora` 不建议先做成一个大而全的查询接口，更适合拆成窄工具：
  - 期权数据
  - 趋势数据
  - 资金数据
- 后续如果需要，可以再补一个通用兜底查询工具，作为长尾或调试入口。
- 研究路由的描述和注册模式可以参考：
  - `src/tools/finance/get-market-data.ts`
  - `src/tools/finance/get-financials.ts`
</decisions>

<canonical_refs>
## Canonical References

- `src/tools/finance/get-market-data.ts`
- `src/tools/finance/get-financials.ts`
- `src/tools/registry.ts`
- `src/agent/prompts.ts`
- `src/tools/finance/index.ts`
</canonical_refs>

<todo_seed>
## Migrated Todo

- Original todo: `Add get_research route tool`
- Original intent: 接收自然语言研究查询，路由到研究子工具，并整合结果
- Relevant files:
  - `src/tools/finance/get-research.ts`
  - `src/tools/finance/index.ts`
  - `src/tools/registry.ts`
  - `src/agent/prompts.ts`
</todo_seed>

---

*Phase: 06-integrate-external-research-data-sources*
*Context gathered: 2026-05-09*
