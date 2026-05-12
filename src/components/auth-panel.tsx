'use client';

import { useState } from 'react';
import { ChevronRight, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { loginAccount, registerAccount } from '@/webui/client/account-api';

type AuthMode = 'login' | 'register';

type AuthPanelProps = {
  mode?: AuthMode;
  onAuthenticated: () => void;
};

export function AuthPanel({ mode = 'login', onAuthenticated }: AuthPanelProps) {
  const [currentMode, setCurrentMode] = useState<AuthMode>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (currentMode === 'register') {
        if (!inviteCode.trim()) {
          throw new Error('请输入邀请码。');
        }
        await registerAccount(email, password, inviteCode);
      } else {
        await loginAccount(email, password);
      }

      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : '认证失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_35%),linear-gradient(180deg,#f8f7f3_0%,#f1efe8_100%)] px-4 py-8 text-zinc-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6 rounded-[2rem] border border-zinc-200/80 bg-white/80 p-8 shadow-[0_20px_80px_rgba(24,24,27,0.10)] backdrop-blur">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="max-w-xl space-y-4">
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Dexter Cloud
            </h1>
            <p className="text-balance text-base leading-7 text-zinc-600 md:text-lg">
              用邮箱密码和邀请码登录，把你的对话历史、会话列表和工作状态都安全保存到云端。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['账号隔离', '每个账号独立保存会话和偏好。'],
              ['历史同步', '首次登录自动导入本机历史。'],
              ['持续恢复', '刷新、换机后继续上一次工作。'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-950">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-zinc-500" />
                  {title}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="border-zinc-200/80 bg-white/90 shadow-[0_20px_80px_rgba(24,24,27,0.14)]">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Lock aria-hidden="true" className="h-4 w-4" />
              账户入口
            </div>
            <CardTitle className="text-2xl">登录或注册</CardTitle>
            <CardDescription>邀请码注册，注册后即可进入你的私有会话空间。</CardDescription>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCurrentMode('login')}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  currentMode === 'login' ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-950',
                )}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => setCurrentMode('register')}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  currentMode === 'register' ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-950',
                )}
              >
                注册
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">邮箱</span>
              <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">密码</span>
              <Input
                type="password"
                autoComplete={currentMode === 'register' ? 'new-password' : 'current-password'}
                placeholder="至少 8 位"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {currentMode === 'register' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">邀请码</span>
                <Input
                  type="text"
                  placeholder="输入邀请码"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                />
              </label>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              className="h-11 w-full rounded-full bg-zinc-950 text-white hover:bg-zinc-800"
              onClick={() => void submit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? '请稍候...' : currentMode === 'register' ? '创建账号' : '登录'}
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>

            <p className="text-xs leading-5 text-zinc-500">
              注册后，现有本地历史会在首次登录时自动导入到云端账号，避免丢失已有对话。
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
