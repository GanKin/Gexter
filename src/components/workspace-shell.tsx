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
import { ChevronRight, CircleAlert, Loader2, PenLine, Send, ShieldCheck, Square, Wrench } from 'lucide-react';

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

  return <MarkdownRenderer content={text} className="space-y-4 text-[15px] leading-7 text-[#17171c]" />;
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
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : isRunning
            ? 'border-zinc-200 bg-white text-zinc-700'
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
    <details className="group mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm text-zinc-700 outline-none transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500">
          <Wrench aria-hidden="true" className="size-4" />
        </span>
        <span className="font-medium">Tools</span>
        <span className="text-zinc-400">{toolCount}</span>
        <ChevronRight
          aria-hidden="true"
          className="ml-auto size-4 text-zinc-400 transition-transform duration-200 group-open:rotate-90"
        />
      </summary>
      <div className="border-t border-zinc-200 px-4 py-3">
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
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
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
    <MessagePrimitive.Root className="w-full py-5">
      <div className={cn('w-full', isUser ? 'max-w-[760px]' : 'max-w-[960px]')}>
        {isUser ? (
          <div className="inline-flex rounded-[8px] bg-[#f1f5ff] px-3 py-3 text-[16px] leading-[1.4] text-[#17171c]">
            <MessagePrimitive.Parts
              components={{
                Text: ({ text }) => <p className="whitespace-pre-wrap break-words">{text}</p>,
                Empty: EmptyPart,
                ToolGroup,
                tools: { Fallback: ToolPart },
              }}
            />
          </div>
        ) : (
          <div className="space-y-4 text-[15px] leading-7 text-[#17171c]">
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

/**
 * ResearchTabHeader - 研究/对话标签页头部
 * 显示当前激活的标签页指示器
 */
function ResearchTabHeader() {
  return (
    <div className="border-b border-zinc-200">
      <div className="inline-flex items-center gap-2 border-b-2 border-[#17171c] pb-3 pt-2">
        <PenLine aria-hidden="true" className="size-4 text-[#17171c]" />
        <span className="text-[16px] font-semibold leading-[1.4] text-[#17171c]">Research</span>
      </div>
    </div>
  );
}

/**
 * ResearchPreview - 空会话预览组件
 * 在没有消息时显示示例内容，引导用户开始对话
 */
function ResearchPreview() {
  const messageCount = useThread((thread) => thread.messages.length);

  // 当已有消息时隐藏预览
  if (messageCount > 0) {
    return null;
  }

  return (
    <div className="space-y-6 pt-5">
      <div className="inline-flex max-w-full rounded-[8px] bg-[#f1f5ff] px-3 py-3 text-[16px] leading-[1.4] text-[#17171c]">
        Explain React hooks like useState and useEffect
      </div>

      <div className="flex items-center gap-2 px-3 text-[14px] leading-[1.4] text-[#75758a]">
        <span>Completed 6 steps</span>
        <ChevronRight aria-hidden="true" className="size-3" />
      </div>

      <div className="space-y-4 px-3 text-[#17171c]">
        <p className="text-[32px] leading-[1.2] font-normal tracking-[-0.02em]">Title</p>
        <p className="text-[24px] leading-[1.2] font-semibold tracking-[-0.03em]">Heading</p>
        <p className="max-w-[920px] text-[16px] leading-[1.4]">
          React Hooks are functions that let you “hook into” React features (like state and lifecycle) from function
          components. They replace most class-based patterns like this.state and lifecycle methods.
        </p>
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
    <div className="w-full max-w-[960px]">
      <ComposerPrimitive.Root className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <ComposerPrimitive.Input
          autoFocus
          placeholder="Ask Dexter about markets, filings, or companies..."
          className="max-h-48 min-h-20 w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-zinc-950 outline-none placeholder:text-zinc-400"
        />
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <span className="px-2 text-xs text-zinc-500">Enter 发送，Shift+Enter 换行</span>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <ComposerPrimitive.Cancel className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:hidden">
                <Square aria-hidden="true" className="size-3.5 fill-current" />
                <span className="sr-only">停止生成</span>
              </ComposerPrimitive.Cancel>
            ) : null}
            <ComposerPrimitive.Send className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400">
              <Send aria-hidden="true" className="size-4" />
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
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="flex min-h-full w-full flex-col px-4 pb-20 pt-5 sm:px-6 md:px-[88px] md:pb-24 md:pt-6">
          <ResearchTabHeader />

          <div className="flex-1 pt-6">
            <ResearchPreview />
            <ThreadPrimitive.Messages
              components={{
                Message: () => <AssistantMessage sessionId={sessionId} onApprove={onApprove} />,
              }}
            />
          </div>

          <div className={cn('pt-20', messageCount === 0 ? 'pt-[24rem] md:pt-[34rem]' : 'md:pt-[24rem]')}>
            <Composer />
          </div>
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
      <main className="flex min-h-screen flex-col overflow-hidden bg-white text-zinc-950 md:flex-row">
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
