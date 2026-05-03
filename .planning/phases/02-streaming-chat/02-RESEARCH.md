# Phase 02 — Streaming Chat: Research

**Researched:** 2026-05-03
**Phase Goal:** 让用户在网页中发起研究会话并看到流式回复
**Requirement:** WEB-03

---

## 1. Agent 事件流架构（已验证）

Dexter Agent 的 `run()` 方法是 `AsyncGenerator<AgentEvent>`，产出 16 种事件类型。Phase 2 需要关注的核心事件：

| 事件类型 | 字段 | UI 用途 |
|----------|------|---------|
| `thinking` | `message: string` | 显示"正在思考"状态 |
| `stream_progress` | `charDelta: number, mode: StreamMode` | 文本流式增量渲染 |
| `tool_start` | `tool: string, args: Record` | 工具开始调用提示 |
| `tool_end` | `tool: string, result: string` | 工具调用完成 |
| `tool_error` | `tool: string, error: string` | 工具调用失败提示 |
| `done` | `answer, toolCalls, iterations, totalTime, tokenUsage` | 最终结果和统计 |

**StreamMode 枚举**：`'requesting' | 'thinking' | 'responding' | 'tool-input' | 'tool-use'`

**关键发现**：`stream_progress` 事件的 `charDelta` 是增量字符数（不是文本本身），前端需要自行维护累积文本。但 `thinking` 事件带 `message` 文本，`done` 事件带完整 `answer`。

**源码路径**：
- 事件定义：`src/agent/types.ts:78-266`
- 流式累积：`src/agent/agent.ts:294-326` (`streamAndAccumulate` 方法)
- 适配器：`src/webui/runtime/adapter.ts` (`runWebSession`)

## 2. Next.js 15 SSE 实现模式

Next.js 15 App Router 的 Route Handler 原生支持 Web Streams API 做 SSE：

```typescript
// src/app/api/runtime/sessions/[id]/chat/route.ts
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 发送 SSE 事件
      const sendEvent = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      // 调用 Agent 并消费事件流
      for await (const event of agent.run(query, session.history)) {
        if (eventFilter.includes(event.type)) {
          sendEvent(event);
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
```

**关键约束**：
- 必须设置 `'X-Content-Type-Options': 'nosniff'`（Next.js 文档要求）
- 必须设置 `'Cache-Control': 'no-cache, no-store'` 防止代理缓冲
- `dynamic = 'force-dynamic'` 防止静态优化
- Next.js 15 的 `params` 是 Promise，需要 `await params`（-breaking change from v14）

## 3. 前端 SSE 消费模式

由于 SSE 端点是 POST 请求（需要传 query），不能用浏览器原生 `EventSource`（只支持 GET）。需要用 `fetch` + `ReadableStream`：

```typescript
const response = await fetch(`/api/runtime/sessions/${sessionId}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value, { stream: true });
  // 解析 SSE 格式: "data: {...}\n\n"
  const events = text
    .split('\n\n')
    .filter(Boolean)
    .map(line => JSON.parse(line.replace('data: ', '')));

  for (const event of events) {
    // 更新 UI 状态
  }
}
```

**注意事项**：
- `decoder.decode(value, { stream: true })` 确保跨 chunk 的 UTF-8 字符正确处理
- SSE `data:` 行可能被拆分到多个 chunk，需要缓冲拼接
- 建议封装一个 `useSSE` hook 统一处理

## 4. 会话注册表（Session Registry）

当前 `createWebRuntimeSession()` 创建会话但不存储引用。Phase 2 需要一个服务端注册表，让 chat 端点能根据 URL 中的 sessionId 找到对应会话：

```typescript
// src/webui/runtime/registry.ts
const sessions = new Map<string, WebRuntimeSession>();

export function registerSession(session: WebRuntimeSession): void {
  sessions.set(session.id, session);
}

export function getSession(id: string): WebRuntimeSession | undefined {
  return sessions.get(id);
}
```

**关键决策**：Phase 2 用内存 Map，不做持久化（Phase 4 范围）。

## 5. 事件过滤策略

CONTEXT.md 决定只推送 6 种事件。过滤应在 `runWebSession` 的 `onEvent` 回调中实现：

```typescript
const PHASE2_EVENTS = new Set([
  'thinking', 'stream_progress', 'tool_start',
  'tool_end', 'tool_error', 'done',
]);
```

**不在 Phase 2 推送的事件**（内部优化事件）：
- `microcompact` — 上下文压缩统计
- `compaction` — LLM 摘要压缩生命周期
- `context_cleared` — 溢出清理
- `queue_drain` — 消息队列排空
- `memory_recalled` / `memory_flush` — 记忆系统
- `tool_approval` / `tool_denied` — 交互式审批（Phase 3）
- `tool_limit` — 工具限制警告

## 6. 前端状态管理

Phase 2 的聊天 UI 需要：

1. **消息列表**：`ChatMessage[]`，每条有 `id`, `role`, `content`, `status`, `toolCalls`
2. **当前流式状态**：`isStreaming: boolean`, `thinkingMessage: string | null`
3. **会话信息**：`sessionId`, `model`, `status`

建议用 React `useState` + 自定义 hook `useChatSession` 管理，不需要引入外部状态库（Phase 2 的状态复杂度不高）。

## 7. 现有 Workspace Shell 改造点

当前 `workspace-shell.tsx` 的 Textarea 是 `disabled` 状态，Phase 2 需要：

- 启用 Textarea 输入
- 添加 Enter 发送逻辑（Shift+Enter 换行）
- 替换 session 创建逻辑（需要存储到 registry）
- 新增聊天消息列表区域
- 新增流式状态指示器（thinking、tool calls）

## Validation Architecture

### 验证维度

| 维度 | 验证方法 |
|------|---------|
| SSE 连接建立 | `curl -N -X POST` 能收到流式事件 |
| 事件格式正确 | 每个 `data:` 行是有效 JSON，包含 `type` 字段 |
| 流式文本渲染 | `stream_progress` 事件逐步追加文本，最终与 `done.answer` 一致 |
| 工具调用展示 | `tool_start` → `tool_end` 显示工具名和状态 |
| 多轮对话 | 发送第二条消息时，历史上下文正确传入 Agent |
| 错误处理 | Agent 异常时 SSE 关闭并返回错误事件 |
| CLI 兼容性 | WebUI 运行时，CLI 仍可正常使用（Phase 1 已验证的基础） |

### 关键测试点

1. **SSE 端点测试**：向 `POST /api/runtime/sessions/{id}/chat` 发送请求，验证响应是 `text/event-stream` 格式
2. **事件过滤测试**：验证只有 6 种 Phase 2 事件被推送到前端
3. **流式渲染测试**：验证 `stream_progress.charDelta` 正确累积
4. **会话隔离测试**：多个并发会话不串台

---

## RESEARCH COMPLETE
