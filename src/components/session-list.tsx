'use client';

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/lib/session-index';

type SessionListProps = {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const deltaMs = date.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(deltaMs) / 60_000);

  if (absMinutes < 1) {
    return '刚刚';
  }

  if (absMinutes < 60) {
    return `${absMinutes} 分钟${deltaMs < 0 ? '前' : '后'}`;
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return `${absHours} 小时${deltaMs < 0 ? '前' : '后'}`;
  }

  const absDays = Math.round(absHours / 24);
  if (absDays === 1) {
    return '昨天';
  }

  return `${absDays} 天${deltaMs < 0 ? '前' : '后'}`;
}

export function SessionList({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}: SessionListProps) {
  const emptyState = useMemo(
    () => (
      <div className="rounded-xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
        还没有历史会话。点击“新建会话”开始一段新的研究。
      </div>
    ),
    [],
  );

  return (
    <Card className="border-border/80 bg-background/70">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-base">会话</CardTitle>
        <CardDescription>最近的聊天记录会同步保存到本地浏览器。</CardDescription>
        <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={onNewSession}>
          <Plus aria-hidden="true" />
          新建会话
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          emptyState
        ) : (
          <div role="listbox" aria-label="会话列表" className="max-h-[240px] space-y-1 overflow-y-auto pr-1">
            {sessions.map((session) => {
              const isActive = session.sessionId === activeSessionId;
              return (
                <div
                  key={session.sessionId}
                  className={cn(
                    'group flex items-start gap-2 rounded-lg border-l-2 px-3 py-2 transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent hover:bg-secondary/80',
                  )}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => onSelectSession(session.sessionId)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (confirm(`删除会话「${session.title}」？`)) {
                        onDeleteSession(session.sessionId);
                      }
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs', isActive ? 'text-primary' : 'text-muted-foreground')}>
                        {isActive ? '●' : '○'}
                      </span>
                      <p className="truncate text-sm font-medium">{session.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(session.lastActiveAt)} · {session.messageCount} 条消息
                    </p>
                  </button>

                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    onClick={() => {
                      if (confirm(`删除会话「${session.title}」？`)) {
                        onDeleteSession(session.sessionId);
                      }
                    }}
                    aria-label={`删除 ${session.title}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
