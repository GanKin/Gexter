# Technology Stack

**Analysis Date:** 2026-05-03

## Languages

**Primary:**
- TypeScript `^5.9.3` - 主要代码位于 `src/`

**Secondary:**
- Bash - 发布脚本 `scripts/release.sh`
- JSON - `package.json`、`.dexter/settings.json`、`.dexter/gateway.json`、`.dexter/cron/jobs.json`
- Markdown - `src/skills/**/SKILL.md`、系统提示与工具描述字符串

## Runtime

**Environment:**
- Bun 为主运行时，入口通过 `bun run src/index.tsx` 启动
- `src/index.tsx` 和 `src/utils/env.ts` 都会加载 `.env`
- `src/memory/database.ts` 在 Bun 下优先使用 `bun:sqlite`，在 Node 下回退到 `better-sqlite3`

**Package Manager:**
- Bun 为主
- Lockfile: `bun.lock` 与 `package-lock.json` 均存在

## Frameworks

**Core:**
- `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/google-genai`, `@langchain/ollama`, `@langchain/exa`, `@langchain/tavily` - LLM 与工具调用层，见 `src/model/llm.ts`、`src/tools/*`
- `@mariozechner/pi-tui` - CLI TUI 渲染与交互，见 `src/cli.ts`
- `zod` - 工具参数与结构化输出校验，见 `src/model/llm.ts`、`src/tools/*`

**Testing:**
- Bun built-in test runner - 主测试入口 `bun test`
- Jest / ts-jest / babel-jest - 兼容性配置，见 `jest.config.js`

**Build/Dev:**
- `tsx` - gateway 脚本入口，见 `package.json`
- `playwright` - Chromium 安装与浏览器自动化，见 `package.json`、`src/tools/browser/browser.ts`
- `dotenv` - 环境变量加载，见 `src/index.tsx`、`src/utils/env.ts`

## Key Dependencies

**Critical:**
- `@langchain/*` - LLM 提供者适配、结构化输出、工具绑定
- `@mariozechner/pi-tui` - CLI UI 框架
- `playwright` - 浏览器工具与 Chromium 运行时
- `better-sqlite3` - 内存索引数据库的 Node.js 回退实现
- `zod` - 工具 schema 与 LLM 结构化输出

**Infrastructure:**
- `langsmith` - eval 运行器与评估数据集管理，见 `src/evals/run.ts`
- `croner` - 定时任务调度，见 `src/cron/*`
- `gray-matter` - `SKILL.md` frontmatter 解析，见 `src/skills/loader.ts`
- `diff` - 文件编辑差异生成，见 `src/tools/filesystem/utils/edit-diff.ts`
- `@mozilla/readability`, `linkedom` - `web_fetch` 内容抽取链路，见 `src/tools/fetch/*`

## Configuration

**Environment:**
- `.env` 通过 `src/index.tsx` 启动时加载，`src/utils/env.ts` 也会在导入时加载
- provider / model 选择持久化到 `.dexter/settings.json`，读写在 `src/utils/config.ts`
- gateway 配置默认位于 `.dexter/gateway.json`，也可通过 `DEXTER_GATEWAY_CONFIG` 覆盖，见 `src/gateway/config.ts`
- Cron 状态默认位于 `.dexter/cron/jobs.json`，见 `src/cron/store.ts`
- 内存索引数据库位于 `.dexter/memory/index.sqlite`，见 `src/memory/index.ts`
- `postinstall` 会执行 `playwright install chromium`

**Build:**
- `package.json` 定义了 `start`、`dev`、`typecheck`、`test`、`gateway` 与 `gateway:login`
- `tsconfig.json` 控制 TypeScript 编译行为
- `.github/workflows/ci.yml` 在 `bun run typecheck` 与 `bun test` 上做 CI

## Platform Requirements

**Development:**
- Bun 运行时
- Chromium 浏览器二进制，由 `postinstall` 安装
- 需要时配置对应 provider 的 API key；无 key 时相关 provider / 工具会不可用

**Production:**
- 终端 CLI 进程是主交付形态
- 另有 gateway / cron / memory 子系统在本地文件系统内运行

---

*Stack analysis: 2026-05-03*
