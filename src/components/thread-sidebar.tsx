'use client';

import { Clock3, PanelLeft, Plus, Sparkles, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/lib/session-index';

type ThreadSidebarProps = {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  isRunning: boolean;
  onNewThread: () => void;
  onSelectThread: (sessionId: string) => void;
  onDeleteThread: (sessionId: string) => void;
};

export function ThreadSidebar({
  sessions,
  activeSessionId,
  isRunning,
  onNewThread,
  onSelectThread,
  onDeleteThread,
}: ThreadSidebarProps) {
  return (
    <aside className="flex border-zinc-200 bg-[#f1f0ed] text-zinc-700 md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-r">
      <div className="flex w-full items-center gap-2 overflow-x-auto px-3 py-3 md:flex-col md:items-stretch md:gap-0 md:overflow-y-auto md:px-4 md:py-5">
        <div className="flex w-full items-start justify-between gap-3 px-1 pb-2 md:px-0 md:pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white shadow-sm">
              <Sparkles aria-hidden="true" className="h-7 w-7" />
            </div>
            <div className="hidden md:block" />
          </div>

          <button
            type="button"
            aria-label="切换侧边栏"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-800"
          >
            <PanelLeft aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 hidden md:block">
          <div className="text-[22px] font-semibold leading-none tracking-tight text-zinc-950">Dexter WebUI</div>
          <div className="mt-2 text-sm text-zinc-500">assistant-ui Perplexity preset</div>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={onNewThread}
          className="flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 text-left text-[15px] font-medium transition hover:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50 md:w-full md:px-4 md:py-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
            <Plus aria-hidden="true" className="h-5 w-5" />
          </span>
          <span>New</span>
        </button>

        <div className="hidden h-px bg-zinc-200 md:my-4 md:block" />

        <div className="flex shrink-0 items-center gap-3 px-3 py-2 text-[15px] font-medium md:px-4 md:py-3">
          <Clock3 aria-hidden="true" className="h-5 w-5 text-zinc-500" />
          <span>History</span>
        </div>

        <div className="flex min-w-0 gap-1 md:mt-1 md:w-full md:flex-col md:gap-1">
          {sessions.length === 0 ? (
            <div className="hidden px-4 py-3 text-sm leading-6 text-zinc-500 md:block">
              还没有历史会话。
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.sessionId === activeSessionId;
              return (
                <div
                  key={session.sessionId}
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 transition md:px-4',
                    isActive ? 'bg-white/75 shadow-sm' : 'hover:bg-zinc-200/70',
                  )}
                >
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => onSelectThread(session.sessionId)}
                    className={cn(
                      'min-w-0 flex-1 truncate text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                      isActive ? 'font-medium text-zinc-950' : 'text-zinc-600 hover:text-zinc-950',
                    )}
                  >
                    {session.title}
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    aria-label={`删除 ${session.title}`}
                    className="rounded-lg p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      if (confirm(`删除会话「${session.title}」？`)) {
                        onDeleteThread(session.sessionId);
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
