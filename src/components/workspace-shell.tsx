'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  useMessage,
  useThread,
  type TextMessagePartProps,
  type ToolCallMessagePartProps,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import {
  Check,
  CircleAlert,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Square,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  clearLegacyWebUiHistory,
  createDexterAssistantAdapter,
  type DexterApprovalView,
  type DexterAssistantMetadata,
} from '@/webui/client/assistant-adapter';
import type { ApprovalDecision } from '@/agent/types';

type RuntimeStatus = 'Checking' | 'Connected' | 'Offline';

function TextPart(_props: TextMessagePartProps) {
  return (
    <MarkdownTextPrimitive
      className="dexter-markdown"
      components={{
        a: ({ className, ...props }) => (
          <a className={cn('text-sky-700 underline-offset-4 hover:underline', className)} {...props} />
        ),
      }}
    />
  );
}

function ToolPart(props: ToolCallMessagePartProps) {
  const isRunning = props.status.type === 'running';
  const isError = props.isError || props.status.type === 'incomplete';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : isRunning
            ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      )}
    >
      {isRunning ? (
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      ) : isError ? (
        <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
      ) : (
        <Check aria-hidden="true" className="h-3.5 w-3.5" />
      )}
      <span className="font-medium">{props.toolName}</span>
      <span className="text-current/70">
        {isRunning ? '运行中' : isError ? '错误' : '完成'}
      </span>
    </div>
  );
}

function ToolGroup({ children }: { children?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap gap-2">{children}</div>;
}

function EmptyPart() {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      <span>Dexter 正在思考...</span>
    </div>
  );
}

function ApprovalCard({
  approval,
  sessionId,
  onApprove,
}: {
  approval: DexterApprovalView;
  sessionId: string | null;
  onApprove: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  const isPending = approval.status === 'pending' && Boolean(sessionId);

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
        工具需要授权：{approval.tool}
      </div>
      <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-white/70 p-2 text-xs text-amber-900">
        {JSON.stringify(approval.args, null, 2)}
      </pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!isPending}
          onClick={() => sessionId && void onApprove(sessionId, approval.id, 'allow-once')}
        >
          允许一次
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isPending}
          onClick={() => sessionId && void onApprove(sessionId, approval.id, 'allow-session')}
        >
          本会话允许
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isPending}
          onClick={() => sessionId && void onApprove(sessionId, approval.id, 'deny')}
        >
          拒绝
        </Button>
        {approval.status !== 'pending' ? (
          <span className="inline-flex items-center text-xs text-amber-800">
            {approval.status === 'approved' ? '已授权' : '已拒绝'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AssistantMessage({
  sessionId,
  onApprove,
}: {
  sessionId: string | null;
  onApprove: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  const role = useMessage((message) => message.role);
  const status = useMessage((message) => message.status);
  const metadata = useMessage((message) => message.metadata.custom as DexterAssistantMetadata | undefined);
  const isUser = role === 'user';

  return (
    <MessagePrimitive.Root
      className={cn(
        'group flex w-full gap-4 px-4 py-5 md:px-8',
        isUser ? 'bg-transparent' : 'bg-white',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
          isUser ? 'border-zinc-300 bg-zinc-100 text-zinc-700' : 'border-zinc-900 bg-zinc-950 text-white',
        )}
      >
        {isUser ? (
          <Search aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Sparkles aria-hidden="true" className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn('max-w-3xl text-[15px] leading-7', isUser ? 'font-medium text-zinc-950' : 'text-zinc-800')}>
          <MessagePrimitive.Parts
            components={{
              Text: isUser
                ? ({ text }) => <p className="whitespace-pre-wrap break-words">{text}</p>
                : TextPart,
              Empty: EmptyPart,
              ToolGroup,
              tools: { Fallback: ToolPart },
            }}
          />
        </div>

        {!isUser && metadata?.thinkingMessage && status?.type === 'running' ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            <span>{metadata.thinkingMessage}</span>
          </div>
        ) : null}

        {!isUser && metadata?.approvalRequest ? (
          <ApprovalCard approval={metadata.approvalRequest} sessionId={sessionId} onApprove={onApprove} />
        ) : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  const isRunning = useThread((thread) => thread.isRunning);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-5 md:px-0">
      <ComposerPrimitive.Root className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_14px_40px_rgba(24,24,27,0.10)]">
        <ComposerPrimitive.Input
          autoFocus
          placeholder="Ask Dexter about markets, filings, or companies..."
          className="max-h-48 min-h-20 w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-zinc-950 outline-none placeholder:text-zinc-400"
        />
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <span className="px-2 text-xs text-zinc-500">Enter 发送，Shift+Enter 换行</span>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <ComposerPrimitive.Cancel className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:hidden">
                <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
                <span className="sr-only">停止生成</span>
              </ComposerPrimitive.Cancel>
            ) : null}
            <ComposerPrimitive.Send className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400">
              <Send aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">发送</span>
            </ComposerPrimitive.Send>
          </div>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}

function EmptyHero() {
  const messageCount = useThread((thread) => thread.messages.length);
  if (messageCount > 0) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-24rem)] max-w-3xl flex-col items-center justify-end px-4 pb-8 pt-12 text-center md:pt-20">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-white">
        <Sparkles aria-hidden="true" className="h-5 w-5" />
      </div>
      <h1 className="text-balance text-4xl font-semibold tracking-normal text-zinc-950 md:text-5xl">
        Dexter
      </h1>
      <p className="mt-4 max-w-xl text-balance text-base leading-7 text-zinc-600">
        面向市场、公司和 SEC 文件的深度金融研究助手。
      </p>
    </div>
  );
}

function Thread({
  sessionId,
  onApprove,
}: {
  sessionId: string | null;
  onApprove: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[#f7f7f4]">
        <EmptyHero />
        <ThreadPrimitive.Messages
          components={{
            Message: () => <AssistantMessage sessionId={sessionId} onApprove={onApprove} />,
          }}
        />
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 bg-gradient-to-t from-[#f7f7f4] via-[#f7f7f4] to-transparent pt-10">
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

export function WorkspaceShell() {
  const [status, setStatus] = useState<RuntimeStatus>('Checking');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const adapter = useMemo(
    () =>
      createDexterAssistantAdapter({
        onSessionId: setSessionId,
        onError: (message) => setError(message || null),
        onRunStateChange: setIsRunning,
      }),
    [],
  );
  const runtime = useLocalRuntime(adapter);

  const loadHealth = async () => {
    try {
      const response = await fetch('/api/runtime/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = (await response.json()) as { ok?: boolean };
      setStatus(data.ok ? 'Connected' : 'Offline');
    } catch {
      setStatus('Offline');
    }
  };

  useEffect(() => {
    void clearLegacyWebUiHistory();
    void loadHealth();
  }, []);

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
      setError('授权请求发送失败。');
    }
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="flex min-h-screen flex-col bg-[#f7f7f4] text-zinc-950">
        <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-[#f7f7f4]/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-white">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Dexter WebUI</div>
                <div className="text-xs text-zinc-500">assistant-ui Perplexity preset</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {error ? (
                <span className="hidden max-w-xs truncate text-xs text-red-600 sm:inline">{error}</span>
              ) : null}
              <Badge variant={status === 'Connected' ? 'default' : 'secondary'}>{status}</Badge>
              {isRunning ? (
                <Badge variant="secondary" className="gap-1.5">
                  <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                  运行中
                </Badge>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void loadHealth()}>
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">刷新</span>
              </Button>
            </div>
          </div>
          {error ? (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 sm:hidden">
              {error}
            </div>
          ) : null}
        </header>

        <Thread sessionId={sessionId} onApprove={approveTool} />
      </main>
    </AssistantRuntimeProvider>
  );
}
