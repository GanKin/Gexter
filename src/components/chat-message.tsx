'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Loader2,
  UserRound,
  WandSparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ApprovalDecision } from '@/agent/types';
import type { ChatMessage as ChatMessageModel, ToolCallInfo } from '@/hooks/use-sse-stream';

type ChatMessageProps = {
  message: ChatMessageModel;
  sessionId: string | null;
  approveTool: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
};

function formatJson(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateText(value: string, limit = 200): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}…`;
}

function renderToolState(tool: ToolCallInfo) {
  if (tool.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        运行中
      </span>
    );
  }

  if (tool.status === 'done') {
    return <span className="text-primary">完成</span>;
  }

  return <span className="text-destructive">错误</span>;
}

function ToolDetails({
  tool,
  expanded,
  onToggle,
}: {
  tool: ToolCallInfo;
  expanded: boolean;
  onToggle: () => void;
}) {
  const toolLabel = tool.tool;
  const isError = tool.status === 'error';
  const cardClassName = cn(
    'border-border/80 bg-background/60 transition-colors',
    isError && 'border-destructive/40 bg-destructive/5',
  );

  return (
    <Card className={cn('space-y-3 rounded-lg p-3', cardClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5',
                isError && 'border-destructive/40 bg-destructive/10 text-destructive',
                tool.status === 'done' && 'bg-primary text-primary-foreground',
              )}
            >
              {tool.status === 'running' ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : tool.status === 'done' ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              <span>{toolLabel}</span>
              <span className="opacity-70">{renderToolState(tool)}</span>
            </Badge>

            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              查看详情
            </button>
          </div>
        </div>

        {typeof tool.duration === 'number' ? (
          <span className="shrink-0 text-xs text-muted-foreground">{tool.duration}ms</span>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">参数</p>
            <pre className="max-h-[120px] overflow-y-auto rounded-md border border-border/60 bg-background/80 p-3 text-sm font-mono whitespace-pre-wrap break-words">
              {formatJson(tool.args ?? {})}
            </pre>
          </div>

          {tool.result ? (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">返回值</p>
              <pre className="max-h-[120px] overflow-y-auto rounded-md border border-border/60 bg-background/80 p-3 text-sm font-mono whitespace-pre-wrap break-words">
                {truncateText(tool.result, 200)}
              </pre>
            </div>
          ) : null}

          {tool.error ? (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">错误</p>
              <pre className="max-h-[120px] overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm font-mono whitespace-pre-wrap break-words text-destructive">
                {tool.error}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function ApprovalCard({
  sessionId,
  approvalRequest,
  approveTool,
}: {
  sessionId: string | null;
  approvalRequest: NonNullable<ChatMessageModel['approvalRequest']>;
  approveTool: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
}) {
  const isPending = approvalRequest.status === 'pending';
  const isDenied = approvalRequest.status === 'denied';

  if (!isPending) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5',
            isDenied
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
          )}
        >
          {isDenied ? <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" /> : <Check aria-hidden="true" className="h-3.5 w-3.5" />}
          <span>{approvalRequest.tool}</span>
          <span className="opacity-70">{isDenied ? '已拒绝' : '已批准'}</span>
        </Badge>
      </div>
    );
  }

  const handleDecision = (decision: ApprovalDecision) => {
    if (!sessionId) {
      return;
    }

    void approveTool(sessionId, approvalRequest.id, decision);
  };

  return (
    <Card className="space-y-3 border-amber-500/40 bg-amber-500/5 p-4 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
            审批请求
          </Badge>
          <span className="text-sm font-medium">{approvalRequest.tool}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{truncateText(formatJson(approvalRequest.args), 160)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => handleDecision('allow-once')} disabled={!sessionId}>
          允许
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleDecision('allow-session')}
          disabled={!sessionId}
        >
          本次会话允许
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => handleDecision('deny')}
          disabled={!sessionId}
        >
          拒绝
        </Button>
      </div>
    </Card>
  );
}

export function ChatMessage({ message, sessionId, approveTool }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isComplete = message.status === 'complete';
  const isAborted = message.status === 'aborted';
  const hasTools = message.toolCalls.length > 0;
  const [expandedTools, setExpandedTools] = useState<Set<string>>(() => new Set());
  const approvalNode =
    !isUser && message.approvalRequest ? (
      <div className="border-t border-border/60 pt-3">
        <ApprovalCard sessionId={sessionId} approvalRequest={message.approvalRequest} approveTool={approveTool} />
      </div>
    ) : null;
  const abortedNode =
    !isUser && isAborted ? (
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">已中止</p>
        <p className="text-xs text-muted-foreground">发送新消息或重新发送</p>
      </div>
    ) : null;

  const toggleTool = (toolKey: string) => {
    setExpandedTools((current) => {
      const next = new Set(current);
      if (next.has(toolKey)) {
        next.delete(toolKey);
      } else {
        next.add(toolKey);
      }
      return next;
    });
  };

  return (
    <Card
      className={cn(
        'w-full max-w-[min(100%,46rem)] border-border/80 shadow-sm',
        isUser
          ? 'ml-auto border-primary/20 bg-primary/10'
          : isComplete
            ? 'mr-auto bg-muted/70'
            : 'mr-auto bg-background',
      )}
    >
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm',
              isUser
                ? 'border-primary/30 bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground',
            )}
          >
            {isUser ? (
              <UserRound aria-hidden="true" className="h-4 w-4" />
            ) : (
              <WandSparkles aria-hidden="true" className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words', isUser ? 'text-foreground' : 'text-foreground')}>
              {isUser ? (
                message.content
              ) : message.status === 'streaming' ? (
                message.thinking ? (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    <span>{message.thinkingMessage ?? '正在思考...'}</span>
                  </div>
                ) : message.content.length > 0 ? (
                  <div className="space-y-3">
                    <div>{message.content}</div>
                    {hasTools ? (
                      <div className="space-y-2">
                        {message.toolCalls.map((tool, index) => {
                          const toolKey = `${tool.tool}-${index}`;
                          return (
                            <ToolDetails
                              key={toolKey}
                              tool={tool}
                              expanded={expandedTools.has(toolKey)}
                              onToggle={() => toggleTool(toolKey)}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        <span>正在生成回复...</span>
                      </div>
                    )}
                  </div>
                ) : hasTools ? (
                  <div className="space-y-3">
                    <div className="text-muted-foreground">Dexter 正在处理工具调用...</div>
                    <div className="space-y-2">
                      {message.toolCalls.map((tool, index) => {
                        const toolKey = `${tool.tool}-${index}`;
                        return (
                          <ToolDetails
                            key={toolKey}
                            tool={tool}
                            expanded={expandedTools.has(toolKey)}
                            onToggle={() => toggleTool(toolKey)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    <span>正在生成回复...</span>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div>{message.content}</div>
                  {hasTools ? (
                    <div className="space-y-3 border-t border-border/60 pt-3">
                      <div className="space-y-2">
                        {message.toolCalls.map((tool, index) => {
                          const toolKey = `${tool.tool}-${index}`;
                          return (
                            <ToolDetails
                              key={toolKey}
                              tool={tool}
                              expanded={expandedTools.has(toolKey)}
                              onToggle={() => toggleTool(toolKey)}
                            />
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">共调用 {message.toolCalls.length} 个工具</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
        {approvalNode}
        {abortedNode}
      </div>
    </Card>
  );
}
