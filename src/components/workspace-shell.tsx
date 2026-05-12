/**
 * WorkspaceShell - AI 助手对话界面主组件
 *
 * 功能：
 * - 用户认证和登录状态管理
 * - 会话线程管理（创建、切换、删除）
 * - 消息渲染（用户消息、助手回复、推理过程）
 * - 工具调用展示和授权管理
 * - 运行时健康检查
 */

'use client';

import { Children, useEffect, useState, type ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
  useThread,
  type TextMessagePartProps,
  type ToolCallMessagePartProps,
} from '@assistant-ui/react';
import {
  ArrowUp,
  BarChart3,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
  Square,
  Wrench,
} from 'lucide-react';

import { AuthPanel } from '@/components/auth-panel';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { ReasoningGroup } from '@/components/reasoning-group';
import { ThreadSidebar } from '@/components/thread-sidebar';
import { cn } from '@/lib/utils';
import { useAssistantThreads } from '@/hooks/use-assistant-threads';
import type { DexterApprovalView, DexterAssistantMetadata } from '@/webui/client/assistant-adapter';
import { summarizeToolTarget } from '@/webui/client/tool-summary';
import type { ApprovalDecision } from '@/agent/types';
import { getCurrentAccount, type AccountUser } from '@/webui/client/account-api';

const THREAD_MAX_WIDTH = '720px';

/**
 * 运行时状态类型
 * - Checking: 正在检查连接状态
 * - Connected: 已连接到运行时
 * - Offline: 运行时离线
 */
type RuntimeStatus = 'Checking' | 'Connected' | 'Offline';

/**
 * TextPart - 文本消息部分渲染器
 * 用于将助手回复中的文本内容渲染为 Markdown
 */
function TextPart(_props: TextMessagePartProps) {
  const { text } = _props;

  return <MarkdownRenderer content={text} className="space-y-4 text-[14px] leading-7 text-[#1d2433]" />;
}

/**
 * ToolPart - 工具调用状态展示组件
 * 根据工具运行状态显示不同的图标和颜色：
 * - 运行中：加载动画，白色背景
 * - 错误：警告图标，红色背景
 * - 完成：完成图标，绿色背景
 */
function ToolPart(props: ToolCallMessagePartProps) {
  // 判断工具运行状态
  const isRunning = props.status.type === 'running';
  const isError = props.isError || props.status.type === 'incomplete';
  // 生成工具调用的简要描述
  const summary = summarizeToolTarget(props.toolName, props.args as Record<string, unknown> | undefined);

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-[0_1px_0_rgba(15,23,42,0.02)]',
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : isRunning
            ? 'border-[#e7edf5] bg-white text-[#5f6878]'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      )}
    >
      {isRunning ? (
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
      ) : isError ? (
        <CircleAlert aria-hidden="true" className="size-3.5" />
      ) : (
        <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-current/10 text-current">
          <span className="size-1.5 rounded-full bg-current" />
        </span>
      )}
      <span className="font-medium">{props.toolName}</span>
      <span className="min-w-0 flex-1 truncate text-current/75">{summary}</span>
      <span className="shrink-0 text-current/70">
        {isRunning ? '运行中' : isError ? '错误' : '完成'}
      </span>
    </div>
  );
}

/**
 * ToolGroup - 工具调用组容器
 * 使用 <details> 元素实现可折叠的工具列表
 */
function ToolGroup({ children }: { children?: ReactNode }) {
  // 计算工具调用数量并显示在标题中
  const toolCount = Children.count(children);

  return (
    <details className="group mt-4 overflow-hidden rounded-[24px] border border-[#e8edf5] bg-[#fafbfc] shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_30px_rgba(15,23,42,0.03)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm text-[#5f6878] outline-none transition hover:bg-white/70 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl border border-[#e8edf5] bg-white text-[#9ca3af]">
          <Wrench aria-hidden="true" className="size-4" />
        </span>
        <span className="font-medium">Tools</span>
        <span className="text-[#9ca3af]">{toolCount}</span>
        <ChevronRight aria-hidden="true" className="ml-auto size-4 text-[#9ca3af] transition-transform duration-200 group-open:rotate-90" />
      </summary>
      <div className="border-t border-[#e8edf5] px-4 py-3">
        <div className="space-y-2">{children}</div>
      </div>
    </details>
  );
}

/**
 * EmptyPart - 空消息部分占位符
 * 用于处理消息中的空内容
 */
function EmptyPart() {
  return null;
}

/**
 * ApprovalCard - 工具授权卡片
 * 当助手需要调用敏感工具时，显示此卡片让用户授权
 * 支持三种授权方式：
 * - 允许一次：仅本次调用允许
 * - 本会话允许：当前会话内的所有调用都允许
 * - 拒绝：拒绝本次调用
 */
function ApprovalCard({
  approval,
  sessionId,
  onApprove,
}: {
  approval: DexterApprovalView;
  sessionId: string | null;
  onApprove: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  // 只有在待处理状态且有会话ID时才允许操作
  const isPending = approval.status === 'pending' && Boolean(sessionId);

  return (
    <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck aria-hidden="true" className="size-4" />
        工具需要授权：{approval.tool}
      </div>
      <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-white/70 p-2 text-xs text-amber-900">
        {JSON.stringify(approval.args, null, 2)}
      </pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          disabled={!isPending}
          onClick={() => sessionId && void onApprove(sessionId, approval.id, 'allow-once')}
        >
          允许一次
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isPending}
          onClick={() => sessionId && void onApprove(sessionId, approval.id, 'allow-session')}
        >
          本会话允许
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isPending}
          onClick={() => sessionId && void onApprove(sessionId, approval.id, 'deny')}
        >
          拒绝
        </button>
        {approval.status !== 'pending' ? (
          <span className="inline-flex items-center text-xs text-amber-800">
            {approval.status === 'approved' ? '已授权' : '已拒绝'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * AssistantMessage - 助手消息组件
 * 渲染用户或助手的消息，包括：
 * - 用户消息：蓝色背景的简单文本
 * - 助手消息：包含推理过程（如果有）和 Markdown 渲染的回复
 * - 工具授权卡片（如果需要授权）
 */
function AssistantMessage({
  sessionId,
  onApprove,
}: {
  sessionId: string | null;
  onApprove: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  // 从消息中提取角色、状态和元数据
  const role = useMessage((message) => message.role);
  const status = useMessage((message) => message.status);
  const metadata = useMessage((message) => message.metadata.custom as DexterAssistantMetadata | undefined);
  const isUser = role === 'user';
  // 提取推理文本并判断是否需要显示推理组件
  const reasoningText = metadata?.reasoningText ?? '';
  const hasReasoning = reasoningText.trim().length > 0;
  const isReasoningActive = status?.type === 'running';

  return (
    <MessagePrimitive.Root className="w-full py-4">
      <div className={cn('w-full', isUser ? 'max-w-[760px]' : 'max-w-[960px]')}>
        {isUser ? (
          <div className="inline-flex max-w-full rounded-[28px] bg-[#eef3fb] px-5 py-4 text-[16px] leading-6 text-[#1d2433] shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <MessagePrimitive.Parts
              components={{
                Text: ({ text }) => <p className="whitespace-pre-wrap break-words text-[14px] leading-6">{text}</p>,
                Empty: EmptyPart,
                ToolGroup,
                tools: { Fallback: ToolPart },
              }}
            />
          </div>
        ) : (
          <div className="space-y-5 text-[16px] leading-8 text-[#1d2433]">
            {!isUser && (hasReasoning || isReasoningActive) ? (
              <ReasoningGroup
                message={reasoningText}
                isActive={isReasoningActive}
                placeholder={metadata?.thinkingMessage ?? '正在思考...'}
              />
            ) : null}
            <MessagePrimitive.Parts
              components={{
                Text: TextPart,
                Empty: EmptyPart,
                ToolGroup,
                tools: { Fallback: ToolPart },
              }}
            />
          </div>
        )}

        {!isUser && metadata?.approvalRequest ? (
          <ApprovalCard approval={metadata.approvalRequest} sessionId={sessionId} onApprove={onApprove} />
        ) : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[36px] border border-[#e8edf5] bg-white px-6 py-8 shadow-[0_20px_70px_rgba(15,23,42,0.05)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.04),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(142,216,235,0.18),transparent_30%)]" />
        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e7edf5] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#5f6878]">
              <Search aria-hidden="true" className="size-3.5" />
              新会话
            </div>
            <div className="space-y-3">
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#1d2433] sm:text-[32px]">
                先说一个你想研究的问题
              </h2>
              <p className="max-w-2xl text-[15px] leading-7 text-[#5f6878] sm:text-[16px]">
                这里会保持干净的空状态，等你输入后再展开消息、图表和推理过程。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: BarChart3,
                title: '行情回顾',
                body: '例如：总结最近一周美股表现。',
              },
              {
                icon: Search,
                title: '个股分析',
                body: '例如：看某只股票的催化剂和风险。',
              },
              {
                icon: Clock3,
                title: '事件追踪',
                body: '例如：跟进财报、政策或行业变化。',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-[24px] border border-[#e8edf5] bg-[#fbfcfe] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[#1d2433]">
                  <span className="inline-flex size-8 items-center justify-center rounded-2xl border border-[#e8edf5] bg-white text-[#9ca3af]">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  {title}
                </div>
                <p className="mt-3 text-sm leading-6 text-[#5f6878]">{body}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {['宏观', '财报', '估值', '风险', '行业比较'].map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-[#e8edf5] bg-white px-3 py-1 text-xs font-medium text-[#5f6878]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Composer - 消息输入组件
 * 提供文本输入框和发送按钮，支持：
 * - 自动聚焦
 * - 发送/取消操作
 * - 快捷键提示（Enter 发送，Shift+Enter 换行）
 */
function Composer() {
  const isRunning = useThread((thread) => thread.isRunning);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <ComposerPrimitive.Root className="rounded-[28px] border border-[#e1e8f1] bg-[#f8fafc]/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <ComposerPrimitive.Input
          autoFocus
          placeholder="Ask Dexter about markets, filings, or companies..."
          className="max-h-40 min-h-16 w-full resize-none bg-transparent px-1 py-1 text-[16px] leading-7 text-[#1d2433] outline-none placeholder:text-[#97a0af]"
        />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e8edf5] pt-3">
          <span className="px-1 text-xs text-[#9ca3af]">Enter 发送，Shift+Enter 换行</span>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <ComposerPrimitive.Cancel className="inline-flex size-9 items-center justify-center rounded-full border border-[#e1e8f1] bg-white text-[#5f6878] transition hover:bg-[#f4f7fb] disabled:hidden">
                <Square aria-hidden="true" className="size-3.5 fill-current" />
                <span className="sr-only">停止生成</span>
              </ComposerPrimitive.Cancel>
            ) : null}
            <ComposerPrimitive.Send className="inline-flex size-9 items-center justify-center rounded-full bg-[#8ed8eb] text-[#0f172a] transition hover:bg-[#7fd0e5] disabled:cursor-not-allowed disabled:bg-[#d9e6ed] disabled:text-[#8aa0af]">
              <ArrowUp aria-hidden="true" className="size-4" />
              <span className="sr-only">发送</span>
            </ComposerPrimitive.Send>
          </div>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}

/**
 * Thread - 消息线程容器
 * 包含消息列表和输入框，管理整个对话视图
 */
function Thread({
  sessionId,
  onApprove,
}: {
  sessionId: string | null;
  onApprove: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  const messageCount = useThread((thread) => thread.messages.length);

  return (
    <ThreadPrimitive.Root
      className="flex h-full min-h-0 flex-1 flex-col"
      style={{ ['--thread-max-width' as string]: THREAD_MAX_WIDTH }}
    >
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto bg-[#fdfdff]">
        <div className="mx-auto flex min-h-full w-full max-w-[var(--thread-max-width)] flex-1 flex-col px-4 pb-4 pt-5 sm:px-6 md:px-0 md:pt-6">
          {messageCount === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-1 flex-col gap-8 pt-6">
              <ThreadPrimitive.Messages
                components={{
                  Message: () => <AssistantMessage sessionId={sessionId} onApprove={onApprove} />,
                }}
              />
            </div>
          )}

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto shrink-0 bg-[#fdfdff] pt-3 pb-2">
            <Composer />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

/**
 * AuthenticatedWorkspace - 已认证用户的工作区
 * 提供完整的 AI 助手对话界面，包括：
 * - 侧边栏：会话列表和管理
 * - 主区域：消息线程和输入框
 * - 运行时健康检查
 * - 工具授权处理
 */
function AuthenticatedWorkspace() {
  // 状态管理：运行时连接状态、错误状态、侧边栏折叠状态
  const [status, setStatus] = useState<RuntimeStatus>('Checking');
  const [isRunning, setIsRunning] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // 初始化线程管理和运行时
  const threads = useAssistantThreads(setIsRunning);
  const runtime = useExternalStoreRuntime(threads.runtimeStore);
  const error = healthError ?? threads.error;

  // 检查运行时健康状态
  const loadHealth = async () => {
    try {
      const response = await fetch('/api/runtime/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = (await response.json()) as { ok?: boolean };
      setStatus(data.ok ? 'Connected' : 'Offline');
      setHealthError(null);
    } catch {
      setStatus('Offline');
      setHealthError('运行时健康检查失败。');
    }
  };

  // 组件挂载时检查运行时健康状态
  useEffect(() => {
    void loadHealth();
  }, []);

  // 处理工具授权请求
  const approveTool = async (
    sessionIdValue: string,
    requestId: string,
    decision: ApprovalDecision,
  ): Promise<void> => {
    try {
      await fetch(`/api/runtime/sessions/${sessionIdValue}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision }),
      });
    } catch {
      setHealthError('授权请求发送失败。');
    }
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#fdfdff] text-zinc-950 md:flex-row">
        <ThreadSidebar
          sessions={threads.sessions}
          activeSessionId={threads.sessionId}
          isRunning={threads.isRunning}
          runtimeStatus={status}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          onNewThread={() => void threads.startNewThread()}
          onSelectThread={(targetSessionId) => void threads.switchThread(targetSessionId)}
          onDeleteThread={(targetSessionId) => void threads.deleteThread(targetSessionId)}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 md:hidden">
              {error}
            </div>
          ) : null}

          <Thread sessionId={threads.sessionId} onApprove={approveTool} />
        </div>
      </main>
    </AssistantRuntimeProvider>
  );
}

/**
 * WorkspaceShell - 工作区主入口组件
 * 根据用户认证状态渲染不同界面：
 * - 加载中：显示加载提示
 * - 未登录：显示登录面板
 * - 已登录：显示完整工作区
 */
export function WorkspaceShell() {
  // 用户认证状态管理
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 组件挂载时加载当前用户信息
  useEffect(() => {
    const loadUser = async () => {
      try {
        const current = await getCurrentAccount();
        setUser(current);
      } catch {
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    void loadUser();
  }, []);

  // 加载状态：显示加载提示
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-zinc-500">
        正在检查登录状态...
      </div>
    );
  }

  // 未登录状态：显示登录面板
  if (!user) {
    return (
      <AuthPanel
        onAuthenticated={async () => {
          const current = await getCurrentAccount();
          if (current) {
            setUser(current);
          }
        }}
      />
    );
  }

  // 已登录状态：显示完整工作区
  return <AuthenticatedWorkspace />;
}
