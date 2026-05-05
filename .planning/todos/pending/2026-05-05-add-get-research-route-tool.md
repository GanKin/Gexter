---
created: 2026-05-05T15:50:47.096Z
title: Add get_research route tool
area: tools
files:
  - src/tools/finance/get-research.ts
  - src/tools/finance/index.ts
  - src/tools/registry.ts
  - src/agent/prompts.ts
  - src/tools/finance/get-market-data.ts:1-196
  - src/tools/finance/get-financials.ts:1-197
---

## Problem

需要添加一个新的 `get_research` 元工具，类似于现有的 `get_market_data` 和 `get_financials`。这个工具应该：

1. 接收自然语言查询（如 "research AAPL AI strategy"）
2. 使用 LLM 路由到具体的研究子工具
3. 整合多个子工具的结果

现有的 `get_market_data` 和 `get_financials` 已经实现了这个模式，可以作为参考。

## Solution

1. **创建 `src/tools/finance/get-research.ts`**：
   - 定义 `GET_RESEARCH_DESCRIPTION` 常量（详细描述，包含 When to Use / When NOT to Use）
   - 实现 `buildRouterPrompt()` 函数（LLM 路由器提示）
   - 定义 `RESEARCH_TOOLS` 数组（子工具列表，如分析师报告、SEC文件分析、新闻情感等）
   - 实现 `createGetResearch(model)` 工厂函数

2. **更新 `src/tools/finance/index.ts`**：
   - 导出 `createGetResearch` 和 `GET_RESEARCH_DESCRIPTION`

3. **更新 `src/tools/registry.ts`**：
   - 在 `getToolRegistry()` 中注册 `get_research` 工具
   - 添加到工具列表，定义 name, tool, description, compactDescription, concurrencySafe

4. **更新 `src/agent/prompts.ts`**：
   - 在 Tool Usage Policy 中添加 `get_research`（第 246 行）

参考 `get-market-data.ts` 和 `get-financials.ts` 的实现模式。
