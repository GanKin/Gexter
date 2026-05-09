'use client';

import { Check, CircleAlert, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { ReasoningGroup } from '@/components/reasoning-group';
import type { ChatMessage as ChatMessageModel } from '@/hooks/use-sse-stream';
import { cn } from '@/lib/utils';

type ChatMessageProps = {
  message: ChatMessageModel;
  sessionId?: string | null;
  approveTool?: (sessionId: string, requestId: string, decision: import('@/agent/types').ApprovalDecision) => Promise<void>;
};

function renderToolBadge(tool: ChatMessageModel['toolCalls'][number], index: number) {
  const badgeClassName =
    tool.status === 'error'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : tool.status === 'done'
        ? 'border-transparent bg-primary text-primary-foreground'
        : 'border-border bg-background text-foreground';

  const icon =
    tool.status === 'running' ? (
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
    ) : tool.status === 'done' ? (
      <Check aria-hidden="true" className="h-3.5 w-3.5" />
    ) : (
      <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
    );

  const label =
    tool.status === 'running' ? '运行中' : tool.status === 'done' ? '完成' : '错误';

  return (
    <Badge key={`${tool.tool}-${index}`} variant="outline" className={cn('gap-1.5', badgeClassName)}>
      {icon}
      <span>{tool.tool}</span>
      <span className="opacity-70">{label}</span>
    </Badge>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isComplete = message.status === 'complete';
  const hasTools = message.toolCalls.length > 0;
  const reasoningText = message.reasoningText?.trim() ?? '';
  const showReasoning = reasoningText.length > 0 || (message.status === 'streaming' && message.thinking);
  const isReasoningActive = message.status === 'streaming' && message.thinking;

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
        <div className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words', isUser ? 'text-foreground' : 'text-foreground')}>
          {isUser ? (
            message.content
          ) : (
            <div className="space-y-3">
              {showReasoning ? (
                <ReasoningGroup
                  message={reasoningText}
                  isActive={isReasoningActive}
                  placeholder={message.thinkingMessage ?? '正在思考...'}
                />
              ) : null}
              {message.status === 'streaming' ? (
                hasTools ? (
                  <div className="space-y-3">
                    <div className="text-muted-foreground">Dexter 正在处理工具调用...</div>
                    <div className="flex flex-wrap gap-2">
                      {message.toolCalls.map(renderToolBadge)}
                    </div>
                  </div>
                ) : !showReasoning ? (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    <span>{message.thinkingMessage ?? '正在生成回复...'}</span>
                  </div>
                ) : null
              ) : (
                <>
                  <MarkdownRenderer content={message.content} />
                  {hasTools ? (
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <div className="flex flex-wrap gap-2">{message.toolCalls.map(renderToolBadge)}</div>
                      <p className="text-xs text-muted-foreground">
                        共调用 {message.toolCalls.length} 个工具
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
