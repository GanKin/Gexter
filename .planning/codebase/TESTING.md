# Testing Patterns

**Analysis Date:** 2026-05-03

## Test Framework

**Runner:**
- 主要运行器是 `bun:test`。
- `package.json` 提供 `bun test` 和 `bun test --watch`，并把 `bun test` 作为默认测试入口。
- `jest.config.js` 仍然存在，属于旧的兼容配置；当前仓库里的实际测试文件没有放在 `__tests__` 下。

**Assertion Library:**
- 使用 Bun 自带断言 API：`describe`、`test`、`expect`、`beforeEach`、`afterEach`。

**Run Commands:**
```bash
bun test
bun test --watch
bun run typecheck
```

## 测试文件组织

**位置：**
- 测试与源码同目录放置，命名为 `*.test.ts`。
- 当前可见测试文件包括 `src/utils/cache.test.ts`、`src/gateway/access-control.test.ts`、`src/gateway/routing/resolve-route.test.ts`、`src/gateway/sessions/store.test.ts`、`src/gateway/channels/whatsapp/reconnect.test.ts`、`src/gateway/utils.test.ts`、`src/controllers/agent-runner.test.ts`。

**命名：**
- `describe` 的标题通常直接使用模块或能力名，例如 `buildCacheKey`、`access control`、`session store`、`resolveRoute`。

**结构：**
```ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';

describe('readCache / writeCache', () => {
  beforeEach(() => {
    // arrange
  });

  afterEach(() => {
    // cleanup
  });

  test('round-trips data through write then read', () => {
    expect(result).not.toBeNull();
  });
});
```

## 测试结构

**Suite 组织：**
- 以 `describe` 分组，内部用短句 `test(...)` 描述行为结果。
- 一个文件内通常只覆盖一个模块，测试名直接对应函数或策略。

**常见模式：**
- 先构造输入，再调用被测函数，再断言返回值或文件系统副作用。
- 对异步函数直接 `await`，不包额外的测试工具层。
- 对错误路径会断言返回 `null`、默认值或 `denyReason`，而不是只检查抛错。

**示例：**
```ts
test('blocks direct message when dmPolicy is disabled', async () => {
  const result = await checkInboundAccessControl({ /* ... */ });
  expect(result.allowed).toBe(false);
  expect(result.shouldMarkRead).toBe(false);
});
```

## Mocking

**框架：**
- 没有检测到 Jest mock、spyOn、Vitest mock 或专门的 mock 框架使用。

**模式：**
- 倾向用轻量假实现和内联函数，例如 `reply: async () => {}`。
- 通过临时环境变量和临时目录隔离副作用，例如 `process.env.DEXTER_PAIRING_PATH`、`process.env.DEXTER_SESSIONS_DIR`、`mkdtempSync(...)`。

**需要 mock 的内容：**
- 外部 I/O、环境变量、持久化目录、以及会产生文件系统副作用的路径。

**不需要 mock 的内容：**
- 小型纯函数和确定性规则，例如路由解析、缓存键构造、电话号码规范化。

## Fixtures 和工厂

**测试数据：**
- 主要采用就地构造对象，而不是统一的 fixture 工厂。
- 复杂输入使用字面量对象并在断言里检查关键字段，例如 `GatewayConfig`、`params`、`result`。

**位置：**
- 目前没有专门的 `test/fixtures` 或共享 factory 目录。

## 覆盖率

**要求：**
- 没有看到强制覆盖率门槛。
- `jest.config.js` 里配置了 `collectCoverageFrom` 和 `coverageDirectory: 'coverage'`，但仓库脚本没有单独的 coverage 命令。

**查看覆盖率：**
```bash
bun test
```
- 当前 CI 不跑 coverage，只跑 `bun run typecheck` 和 `bun test`。

## 测试类型

**单元测试：**
- 主体是单元测试，覆盖纯函数、配置解析、路由规则、缓存读写和访问控制。

**集成测试：**
- 没有明显独立的集成测试套件。
- 现有测试中最接近集成的场景是文件系统和环境变量交互，例如缓存、会话存储、配对请求记录。

**E2E 测试：**
- 未检测到独立的端到端测试框架或目录。

## 常见模式

**异步测试：**
```ts
test('allows self-chat fromMe direct message', async () => {
  const result = await checkInboundAccessControl({ /* ... */ });
  expect(result.allowed).toBe(true);
});
```

**错误测试：**
```ts
test('returns null and removes file when cache entry is corrupted JSON', () => {
  const cached = readCache(endpoint, params);
  expect(cached).toBeNull();
  expect(existsSync(filepath)).toBe(false);
});
```

## 验证机制

**本地：**
- `bun test` 是主验证入口。
- `bun run typecheck` 是额外的静态验证入口。

**CI：**
- `.github/workflows/ci.yml` 在 `push` 和 `pull_request` 上运行 `bun run typecheck` 与 `bun test`。

---

*Testing analysis: 2026-05-03*
