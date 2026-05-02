# Coding Conventions

**Analysis Date:** 2026-05-03

## 命名模式

**文件：**
- 源码文件以 `kebab-case` 为主，放在 `src/` 下的分层目录中，例如 `src/gateway/routing/resolve-route.ts`、`src/tools/finance/get-financials.ts`。
- 测试文件使用同目录旁置命名 `*.test.ts`，例如 `src/utils/cache.test.ts`、`src/gateway/access-control.test.ts`。
- React / Ink 组件文件同样使用 `kebab-case`，例如 `src/components/chat-log.ts`、`src/components/approval-prompt.ts`。

**函数：**
- 以 `camelCase` 命名，例如 `buildCacheKey`、`resolveRoute`、`checkInboundAccessControl`、`runCli`。
- 布尔判断函数通常直接表达语义，例如 `isAllowedPhone`、`isSelfChatMode`、`isContextOverflowError`。

**类型：**
- 类型名使用 `PascalCase`，例如 `GatewayConfig`、`ResolvedRoute`、`InboundAccessControlResult`、`LogEntry`。
- 联合类型和字面量类型广泛使用，例如 `ErrorType`、`LogLevel`、`SelectionState`。

**常量：**
- 模块级常量使用 `UPPER_SNAKE_CASE`，例如 `DEFAULT_GATEWAY_PATH`、`PAIRING_REPLY_HISTORY_GRACE_MS`、`DEFAULT_MODEL`、`CACHE_DIR`。

## 代码风格

**格式化：**
- 当前仓库没有检测到 `.prettierrc`、`prettier.config.*`、`eslint.config.*`、`.eslintrc*` 或 `biome.json`。
- 代码风格主要由现有源码一致性维持；`tsconfig.json` 开启了 `strict`、`forceConsistentCasingInFileNames`、`moduleResolution: "bundler"` 和 `jsx: "react-jsx"`。
- 代码中普遍使用分号、单引号、尾随逗号和较短的函数分段注释。

**类型习惯：**
- 倾向显式类型定义，而不是隐式 `any`。
- 许多边界值通过 `zod` 解析或 `satisfies` 约束，例如 `src/gateway/config.ts`、`src/tools/browser/browser.ts`、`src/tools/skill.ts`。
- 复杂对象常使用 `Record<string, unknown>`、`ReadonlyArray`、字面量联合和 `type` 别名。

## 导入组织

**顺序：**
1. Node.js 内建模块，例如 `node:fs`、`node:path`、`node:crypto`。
2. 第三方包，例如 `zod`、`playwright`、`@langchain/core/tools`。
3. 项目内部相对导入，例如 `../utils/logger.js`、`./cache.js`。

**路径别名：**
- `tsconfig.json` 定义了 `@/* -> ./src/*`。
- 实际代码里别名使用较少，但已可见于 `src/tools/browser/browser.ts` 的 `@/utils` 导入。

## 错误处理

**模式：**
- 边界层函数常用 `try/catch` 把底层异常转换为可读的 `Error`，例如 `src/tools/finance/api.ts`、`src/tools/search/tavily.ts`、`src/tools/search/x-search.ts`。
- 失败后通常返回安全默认值或空对象，而不是继续抛出未经处理的异常，例如 `src/utils/config.ts`、`src/utils/cache.ts`、`src/gateway/config.ts`。
- 文件和配置解析采用“失败即回退”的策略：无效 JSON、缺失文件或结构不符时返回 `null` / 默认配置，并尽量清理坏数据。

**验证：**
- `zod` 用于结构验证，见 `src/gateway/config.ts`、`src/tools/filesystem/read-file.ts`、`src/tools/skill.ts`。
- 另外还有手写守卫，例如 `src/utils/cache.ts` 的 `isValidCacheEntry`，以及 `src/utils/errors.ts` 的错误模式分类逻辑。

## 日志

**框架：**
- 项目有自定义内存日志器 `src/utils/logger.ts`，用于 UI 调试面板和可订阅日志展示。
- 同时，网关和若干工具模块直接使用 `console.log` / `console.error`，例如 `src/gateway/index.ts`、`src/gateway/gateway.ts`、`src/gateway/channels/whatsapp/login.ts`。

**模式：**
- 日志消息通常包含组件前缀或操作前缀，例如 `[Financial Datasets API]`、`[whatsapp]`、`[Browser (Playwright)]`。
- `src/utils/cache.ts` 在缓存损坏、读取失败、写入失败时记录 `warn` 级别日志，并尽量继续执行。

## 注释

**何时注释：**
- 仅对非显而易见的控制流、迁移逻辑、失败回退和业务约束加简短注释。
- 仓库里已存在不少解释性注释，例如 `src/gateway/access-control.ts`、`src/utils/cache.ts`、`src/tools/finance/api.ts`。

**TSDoc / JSDoc：**
- 公共 API 和工具描述常使用块注释或长字符串说明，用于给 LLM 和调用方提供上下文，例如 `src/tools/browser/browser.ts`、`src/tools/filesystem/read-file.ts`。

## 函数设计

**规模：**
- 逻辑通常拆成小的纯辅助函数，再由导出函数组合；复杂模块会使用早返回来减少嵌套。
- `src/gateway/routing/resolve-route.ts`、`src/utils/cache.ts`、`src/gateway/access-control.ts` 都体现了这种分层方式。

**参数：**
- 复杂调用偏好单个对象参数，而不是长位置参数列表，例如 `checkInboundAccessControl(params)`、`resolveRoute(input)`、`api.get(endpoint, params, options)`.

**返回值：**
- 成功时返回结构化对象；失败时返回 `null`、空对象或显式错误。
- 异步函数统一返回 `Promise`，并在调用点显式 `await`。

## 模块设计

**导出：**
- 仓库广泛使用命名导出，少量默认导出基本不见。
- `src/utils/index.ts`、`src/tools/index.ts`、`src/components/index.ts`、`src/controllers/index.ts` 作为 barrel 文件集中再导出。

**Barrel 文件：**
- 新代码通常先添加到具体文件，再由对应 `index.ts` 暴露给上层。
- 这种模式让上层导入更稳定，但具体实现仍应以文件级路径为准。

---

*Convention analysis: 2026-05-03*
