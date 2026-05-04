'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

import { ChatInput } from '@/components/chat-input';
import { ChatMessage } from '@/components/chat-message';
import { ModelSelector } from '@/components/model-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useChatSession } from '@/hooks/use-chat-session';
import type { RuntimeHealth } from '@/webui/runtime/types';

type RuntimeStatus = 'Checking' | 'Connected' | 'Offline';

export function WorkspaceShell() {
  const [status, setStatus] = useState<RuntimeStatus>('Checking');
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const {
    messages,
    isStreaming,
    sessionId,
    currentModel,
    changeModel,
    sendQuery,
    approveTool,
    abortSession,
    error,
  } = useChatSession();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadHealth = async () => {
    try {
      const response = await fetch('/api/runtime/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = (await response.json()) as RuntimeHealth;
      setHealth(data);
      setStatus(data.ok ? 'Connected' : 'Offline');
    } catch {
      setStatus('Offline');
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-visible border-border/80 bg-card/90 backdrop-blur">
          <CardHeader className="gap-4 border-b border-border/80 bg-gradient-to-br from-primary/8 via-transparent to-accent/20">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Dexter WebUI
                </p>
                <CardTitle className="mt-1 text-2xl">Dexter WebUI</CardTitle>
              </div>
            </div>
            <CardDescription>
              面向本地 Dexter runtime 的 Next.js + shadcn/ui 外壳。
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/80 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Runtime</p>
                <p className="mt-1 text-base font-medium">{status}</p>
              </div>
              <Badge variant={status === 'Connected' ? 'default' : 'secondary'}>{status}</Badge>
            </div>

            <div className="grid gap-3 rounded-xl border border-border bg-background/70 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Runtime</p>
                <p className="mt-1 font-medium">{health?.runtime ?? 'dexter'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mode</p>
                <p className="mt-1 font-medium">{health?.mode ?? 'webui'}</p>
              </div>
              <Separator />
              <ModelSelector currentModel={currentModel} onModelChange={changeModel} />
            </div>

            <div className="grid gap-3 rounded-xl border border-border bg-background/70 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Session</p>
                <p className="mt-1 text-sm font-medium">
                  {sessionId ? `${sessionId.slice(0, 12)}…` : 'Waiting for first prompt'}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Model</p>
                <p className="mt-1 text-sm font-medium">{currentModel}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="min-h-0">
          <Card className="flex h-full min-h-[calc(100vh-2rem)] flex-col overflow-hidden border-border/80 bg-card/90 backdrop-blur">
            <CardHeader className="gap-3 border-b border-border/80 bg-gradient-to-br from-background via-transparent to-primary/5">
              <Badge variant="secondary" className="w-fit">
                Local Dexter Workspace
              </Badge>
              <CardTitle className="text-2xl tracking-tight sm:text-3xl">Chat with Dexter</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                输入问题、查看工具调用和等待流式回复。左侧保留运行态，右侧专注对话。
              </CardDescription>
              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => void loadHealth()}>
                  <RefreshCw aria-hidden="true" data-icon="inline-start" />
                  Refresh status
                </Button>
              </div>
            </CardHeader>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
                {messages.length === 0 ? (
                  <Card className="border-dashed border-border/60 bg-background/60">
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">
                        发送第一条消息开始一个 Dexter 会话。
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        sessionId={sessionId}
                        approveTool={approveTool}
                      />
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <ChatInput onSend={sendQuery} onAbort={abortSession} disabled={isStreaming} />
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
