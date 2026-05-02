# Codebase Concerns

**Analysis Date:** 2026-05-03

## Tech Debt

**明文持久化与本地状态膨胀**
- Issue: `src/utils/env.ts` 会直接读取和写入 `.env`；`src/gateway/channels/whatsapp/auth-store.ts` 保存 `creds.json` 和 `creds.json.bak`；`src/utils/long-term-chat-history.ts`、`src/memory/store.ts`、`src/memory/database.ts`、`src/gateway/sessions/store.ts`、`src/cron/store.ts`、`src/utils/tool-result-storage.ts` 都把会话、记忆、调度和大结果以明文形式落盘。
- Impact: API key、WhatsApp 凭据、聊天历史、记忆和工具输出会长期保留在本机磁盘上，备份、同步或本地入侵都会扩大泄露面；`tool-results` 里的内容还会再次暴露给 `read_file`。
- Fix approach: 把密钥和运行态状态拆分存放，给敏感目录加严格权限，增加可配置加密/TTL 清理，并为 `tool-results`、聊天历史和记忆文件提供显式 purge 流程。

**配置与状态写入缺少统一的原子性**
- Issue: `src/utils/config.ts`、`src/utils/env.ts`、`src/gateway/config.ts`、`src/gateway/sessions/store.ts`、`src/gateway/access-control.ts`、`src/memory/store.ts`、`src/utils/tool-result-storage.ts` 都是直接写文件；只有 `src/cron/store.ts` 采用了临时文件 + `renameSync`。
- Impact: 并发工具调用、网关运行和手工编辑同时发生时，JSON/TXT 文件可能互相覆盖或写出半成品，导致会话、配对码、配置和记忆状态丢失。
- Fix approach: 统一采用临时文件原子替换和必要的文件锁；对高频写入路径加队列化或集中写入层。

## Security Considerations

**任意外部 URL 访问带来 SSRF 与内网探测面**
- Issue: `src/tools/fetch/web-fetch.ts` 只限制为 `http:`/`https:`，但没有阻止 `localhost`、内网地址或本地服务；`src/tools/browser/browser.ts` 也可直接 `navigate`/`open` 到任意 URL。`src/tools/fetch/external-content.ts` 的包裹与 `detectSuspiciousPatterns` 只是提示，不是阻断。
- Impact: 模型可以借由 `web_fetch` 或 `browser` 访问本机服务、内网面板或元数据端点，形成 SSRF/数据外带路径；抓取到的恶意页面内容仍会进入上下文。
- Fix approach: 增加 URL policy，默认阻止私网、环回和 file-like 目标；对外部内容增加隔离/白名单/人工确认选项，而不是只做包装。

**WhatsApp 认证目录和网关路径可被配置重定向**
- Issue: `src/gateway/config.ts` 的 `authDir` 可由配置覆盖；`src/gateway/access-control.ts` 允许 `DEXTER_PAIRING_PATH`；`src/gateway/sessions/store.ts` 允许 `DEXTER_SESSIONS_DIR`；`src/gateway/config.ts` 允许 `DEXTER_GATEWAY_CONFIG`。这些路径没有统一的根目录约束或符号链接校验。
- Impact: 一旦配置或环境变量被错误设置，凭据、会话和配对状态会写到意料之外的位置，增加覆盖宿主文件和泄露敏感状态的风险。
- Fix approach: 对所有可配置路径做白名单根目录校验，拒绝 symlink 和上跳路径，并在写入前明确记录最终解析路径。

**工具输出持久化会放大敏感信息外泄**
- Issue: `src/utils/tool-result-storage.ts` 会把超长工具结果原文写到 `.dexter/tool-results/*.txt`；`src/tools/fetch/web-fetch.ts`、`src/tools/finance/api.ts`、`src/tools/search/*.ts`、`src/tools/browser/browser.ts` 获取的外部内容都可能包含 cookie、token、个人信息或私有页面文本。
- Impact: 任何被持久化的敏感响应都会在本地留存，且可以被后续工具重新读取，形成二次泄露面。
- Fix approach: 在持久化前按工具类型做 redaction，给结果文件设定过期清理，并允许对敏感工具关闭落盘。

## Performance Bottlenecks

**同步 I/O 和全局单例压在运行主路径上**
- Issue: `src/gateway/gateway.ts`、`src/cron/runner.ts`、`src/gateway/channels/whatsapp/runtime.ts`、`src/memory/indexer.ts`、`src/utils/env.ts`、`src/utils/config.ts`、`src/gateway/channels/whatsapp/auth-store.ts`、`src/cron/executor.ts` 都在热路径上做同步读写或长时间轮询；`src/tools/browser/browser.ts` 还维持一个全局 browser/page 单例并用 `headless: false` 启动。
- Impact: 事件循环会被日志和文件 I/O 阻塞，长会话下可能拖慢消息处理、调度触发和记忆同步；浏览器实例如果不及时关闭，也会占用额外资源并污染后续任务状态。
- Fix approach: 把同步写入改成异步批处理，给日志和状态更新加缓冲队列，浏览器按任务生命周期打开/关闭，避免长生命周期共享 page。

## Fragile Areas

**网关、cron、记忆和去重状态依赖进程内内存**
- Files: `src/gateway/agent-runner.ts`, `src/gateway/channels/whatsapp/dedupe.ts`, `src/gateway/channels/whatsapp/runtime.ts`, `src/cron/executor.ts`, `src/cron/runner.ts`, `src/memory/indexer.ts`, `src/utils/in-memory-chat-history.ts`.
- Why fragile: 这些模块把队列、重试退避、抑制状态、最近消息去重和聊天历史缓存放在进程内；进程重启或崩溃会丢掉这些状态，导致重复处理、重复通知或上下文断裂。
- Safe modification: 如果要改动消息/调度语义，优先把状态迁移到持久层，再调整队列和重试逻辑；避免把新的幂等性假设建立在内存 Map 上。
- Test coverage: 现有测试集中在 `src/gateway/access-control.test.ts`、`src/gateway/routing/resolve-route.test.ts`、`src/gateway/sessions/store.test.ts`、`src/gateway/utils.test.ts`、`src/controllers/agent-runner.test.ts`、`src/utils/cache.test.ts`、`src/gateway/channels/whatsapp/reconnect.test.ts`，未覆盖这些核心状态机。

**记忆与聊天历史会自动被索引**
- Files: `src/memory/index.ts`, `src/memory/indexer.ts`, `src/memory/database.ts`, `src/memory/session-files.ts`, `src/utils/long-term-chat-history.ts`.
- Why fragile: `chat_history.json`、`MEMORY.md` 和每日日志会被自动索引进 SQLite，任何写入都会影响搜索、召回和后续对话提示词。
- Safe modification: 修改记忆格式、分词、嵌入或索引规则时，需要同步检查迁移、缓存失效和历史兼容性。
- Test coverage: 当前没有看到直接覆盖记忆索引、SQLite 迁移和会话文件解析的测试。

## Dependencies at Risk

**外部 SDK 和服务强绑定运行时行为**
- Files: `src/model/llm.ts`, `src/tools/browser/browser.ts`, `src/tools/fetch/web-fetch.ts`, `src/tools/finance/api.ts`, `src/tools/search/exa.ts`, `src/tools/search/tavily.ts`, `src/tools/search/perplexity.ts`, `src/tools/search/x-search.ts`, `src/gateway/channels/whatsapp/session.ts`, `src/memory/embeddings.ts`.
- Risk: `@whiskeysockets/baileys`, `playwright`, `better-sqlite3`, `croner`, `exa-js` 和多个云端 API 的行为变化都会直接影响登录、抓取、存储、调度和模型调用。
- Impact: 版本漂移、平台不兼容或供应商 API 变更会导致网关启动失败、浏览器工具失效、数据库打开失败或搜索结果格式变化。
- Migration plan: 锁定版本并把关键路径做启动自检和最小烟雾测试，尤其是 WhatsApp 登录、浏览器抓取、SQLite 打开和外部搜索返回形状。

## Missing Critical Features

**缺少明确的保留期、清理和脱敏策略**
- Problem: `.dexter/messages/chat_history.json`、`.dexter/MEMORY.md`、每日记忆日志、`.dexter/tool-results/`、WhatsApp `creds.json` 和网关日志没有统一的 retention 或 purge 机制。
- Blocks: 无法可靠回答“这些敏感数据会保留多久、怎么删除、怎么证明已清理”。

## Test Coverage Gaps

**高风险集成缺少直接测试**
- What’s not tested: `src/tools/browser/browser.ts`、`src/tools/fetch/web-fetch.ts`、`src/cron/executor.ts`、`src/cron/runner.ts`、`src/gateway/channels/whatsapp/auth-store.ts`、`src/utils/tool-result-storage.ts`、`src/utils/env.ts`、`src/memory/index.ts`、`src/memory/store.ts`。
- Files: `src/tools/browser/browser.ts`, `src/tools/fetch/web-fetch.ts`, `src/cron/executor.ts`, `src/cron/runner.ts`, `src/gateway/channels/whatsapp/auth-store.ts`, `src/utils/tool-result-storage.ts`, `src/utils/env.ts`, `src/memory/index.ts`, `src/memory/store.ts`.
- Risk: 这些模块都涉及外部网络、磁盘落盘、权限边界或长生命周期状态，出问题时很容易只在真实运行时暴露。
- Priority: High.

---

*Concerns audit: 2026-05-03*
