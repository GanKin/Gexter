# External Integrations

**Analysis Date:** 2026-05-03

## APIs & External Services

**LLM Providers:**
- OpenAI - 默认 provider；`ChatOpenAI` 与 `OpenAIEmbeddings`，见 `src/model/llm.ts`、`src/memory/embeddings.ts`
  - Auth: `OPENAI_API_KEY`
- Anthropic - `ChatAnthropic`；系统提示在 `src/model/llm.ts` 中对 system prompt 使用 `cache_control`
  - Auth: `ANTHROPIC_API_KEY`
- Google - `ChatGoogleGenerativeAI` 与 `GoogleGenerativeAIEmbeddings`
  - Auth: `GOOGLE_API_KEY`
- xAI - 通过 `ChatOpenAI` 指向 `https://api.x.ai/v1`
  - Auth: `XAI_API_KEY`
- OpenRouter - 通过 `ChatOpenAI` 指向 `https://openrouter.ai/api/v1`
  - Auth: `OPENROUTER_API_KEY`
- Moonshot - 通过 `ChatOpenAI` 指向 `https://api.moonshot.cn/v1`
  - Auth: `MOONSHOT_API_KEY`
- DeepSeek - 通过 `ChatOpenAI` 指向 `https://api.deepseek.com`
  - Auth: `DEEPSEEK_API_KEY`
- Ollama - 本地模型服务；`ChatOllama` 与 `OllamaEmbeddings`
  - Auth: `OLLAMA_BASE_URL` 可选，默认 `http://localhost:11434`

**Financial Data:**
- Financial Datasets - 财务报表、估值、股价、加密货币、新闻、内幕交易、SEC filings、股票筛选器都通过 `https://api.financialdatasets.ai` 调用，见 `src/tools/finance/api.ts`
  - SDK/Client: 自定义 `api.get` / `api.post` 包装器 + `fetch`
  - Auth: `FINANCIAL_DATASETS_API_KEY`

**Search Services:**
- Exa - `web_search` 的首选实现，见 `src/tools/search/exa.ts`
  - SDK/Client: `exa-js` + `@langchain/exa`
  - Auth: `EXASEARCH_API_KEY`
- Perplexity - `web_search` 备选实现，直接调用 chat completions 接口，见 `src/tools/search/perplexity.ts`
  - Auth: `PERPLEXITY_API_KEY`
- Tavily - `web_search` 备选实现，见 `src/tools/search/tavily.ts`
  - SDK/Client: `@langchain/tavily`
  - Auth: `TAVILY_API_KEY`
- X/Twitter - `x_search` 通过官方 X API v2 读取公开内容，见 `src/tools/search/x-search.ts`
  - Auth: `X_BEARER_TOKEN`

**Evals & Telemetry:**
- LangSmith - eval 运行器与数据集管理，见 `src/evals/run.ts`
  - SDK/Client: `langsmith`
  - Auth: `LANGSMITH_API_KEY`
  - Related config: `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`

**Web Content Access:**
- `web_fetch` - 直接 HTTP 抓取与内容抽取，见 `src/tools/fetch/web-fetch.ts`
- `browser` - 本地 Chromium + Playwright 自动化，见 `src/tools/browser/browser.ts`
- 这两者不依赖第三方 SaaS API；它们访问的是用户给定的目标 URL 或页面

## Data Storage

**Databases:**
- SQLite - `.dexter/memory/index.sqlite`，由 `src/memory/index.ts` 创建，`src/memory/database.ts` 提供兼容层

**File Storage:**
- 本地文件系统为主
- `.dexter/memory/MEMORY.md` 与 `.dexter/memory/YYYY-MM-DD.md` 存放长期/日记式记忆，见 `src/memory/store.ts`
- `.dexter/messages/chat_history.json` 存放会话历史，见 `src/utils/long-term-chat-history.ts`
- `.dexter/cron/jobs.json` 存放定时任务，见 `src/cron/store.ts`
- `.dexter/gateway.json` 存放 gateway 配置，见 `src/gateway/config.ts`
- `.dexter/settings.json` 存放 provider / model 选择，见 `src/utils/config.ts`

**Caching:**
- 财务 API 与 web fetch 都使用进程内缓存，分别见 `src/tools/finance/api.ts` 与 `src/tools/fetch/cache.ts`

## Authentication & Identity

**Auth Provider:**
- 无统一身份系统
- 外部认证主要是各 provider 的 API key / bearer token
- 本地 Ollama 不需要云端认证

## Monitoring & Observability

**Error Tracking:**
- 未检测到独立的外部错误追踪服务

**Logs:**
- 运行时日志使用本地内存 logger `src/utils/logger.ts`
- `src/model/llm.ts`、`src/tools/*` 会把失败写入该 logger

## CI/CD & Deployment

**Hosting:**
- 主要交付形态是本地终端 CLI
- 还有 gateway / cron 的本地进程模式，见 `src/gateway/*`、`src/cron/*`

**CI Pipeline:**
- GitHub Actions `./.github/workflows/ci.yml` 运行 `bun run typecheck` 与 `bun test`
- 发布脚本 `scripts/release.sh` 负责版本号、git tag 和 GitHub Release

## Environment Configuration

**Required env vars:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `OPENROUTER_API_KEY`
- `MOONSHOT_API_KEY`
- `DEEPSEEK_API_KEY`
- `OLLAMA_BASE_URL`
- `FINANCIAL_DATASETS_API_KEY`
- `EXASEARCH_API_KEY`
- `PERPLEXITY_API_KEY`
- `TAVILY_API_KEY`
- `X_BEARER_TOKEN`
- `LANGSMITH_API_KEY`
- `LANGSMITH_ENDPOINT`
- `LANGSMITH_PROJECT`
- `LANGSMITH_TRACING`
- `DEXTER_GATEWAY_CONFIG`
- `DEXTER_SESSIONS_DIR`
- `DEXTER_PAIRING_PATH`

**Secrets location:**
- 通过环境变量 `.env` 提供，`src/utils/env.ts` 也支持直接读取 `.env`
- `.env` 文件本身不应提交到仓库

## Webhooks & Callbacks

**Incoming:**
- 未检测到通用 Webhook 入口

**Outgoing:**
- 对外 HTTP 调用主要来自 `src/model/llm.ts`、`src/tools/finance/*`、`src/tools/search/*`、`src/tools/fetch/*`

---

*Integration audit: 2026-05-03*
