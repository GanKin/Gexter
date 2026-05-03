'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { RuntimeHealth } from '@/webui/runtime/types';

type RuntimeStatus = 'Checking' | 'Connected' | 'Offline';

export function WorkspaceShell() {
  const [status, setStatus] = useState<RuntimeStatus>('Checking');
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId: string;
    model: string;
    status: string;
  } | null>(null);

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

  const createSession = async () => {
    try {
      const response = await fetch('/api/runtime/sessions', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        sessionId: string;
        model: string;
        status: string;
      };
      setSessionInfo(data);
    } catch {
      setSessionInfo({
        sessionId: 'offline',
        model: health?.model ?? 'gpt-5.4',
        status: 'error',
      });
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-border/80 bg-card/90 backdrop-blur">
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
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Model</p>
                <p className="mt-1 font-medium">{health?.model ?? 'Checking…'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4">
          <Card className="border-border/80 bg-card/90 backdrop-blur">
            <CardHeader className="gap-3">
              <Badge variant="secondary" className="w-fit">
                Local Dexter Workspace
              </Badge>
              <CardTitle className="text-3xl tracking-tight sm:text-4xl">
                Browser shell for research, not a landing page.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base">
                这是一个面向研究任务的工作台首屏，保留 Dexter 的运行边界，同时用 Next.js
                App Router 和 shadcn/ui 组织界面。
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="prompt-composer">
                    Prompt Composer
                  </label>
                  <span className="text-xs text-muted-foreground">Disabled for Phase 1 shell</span>
                </div>
                <Textarea
                  id="prompt-composer"
                  placeholder="Ask Dexter about markets, filings, or companies"
                  disabled
                  className="min-h-[180px] resize-none bg-background/80"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="default" onClick={() => void loadHealth()}>
                  <RefreshCw aria-hidden="true" data-icon="inline-start" />
                  Refresh status
                </Button>
                <Button type="button" variant="outline" onClick={() => void createSession()}>
                  <ShieldCheck aria-hidden="true" data-icon="inline-start" />
                  New session
                </Button>
              </div>

              {sessionInfo ? (
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Session
                  </p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID:</span>{' '}
                      <span className="font-medium">{sessionInfo.sessionId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Model:</span>{' '}
                      <span className="font-medium">{sessionInfo.model}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <span className="font-medium">{sessionInfo.status}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">Current boundary</CardTitle>
              <CardDescription>
                WebUI 仅负责 shell、健康状态和后续入口，不复制 CLI / Agent / Gateway 核心。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                ['UI', 'Next.js App Router'],
                ['Components', 'shadcn/ui primitives'],
                ['Transport', '/api/runtime/*'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                  <p className="mt-2 font-medium">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
