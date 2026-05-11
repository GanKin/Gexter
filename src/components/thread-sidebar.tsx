'use client';

import type { ReactNode } from 'react';

import { Inbox, PanelLeftClose, Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/lib/session-index';

type RuntimeStatus = 'Checking' | 'Connected' | 'Offline';

type ThreadSidebarProps = {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  isRunning: boolean;
  runtimeStatus: RuntimeStatus;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewThread: () => void;
  onSelectThread: (sessionId: string) => void;
  onDeleteThread: (sessionId: string) => void;
};

function SidebarIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md bg-zinc-200 text-zinc-600',
        className,
      )}
    >
      {children}
    </span>
  );
}

function PlaceholderThreads({
  activeThreadIndex,
  isCollapsed,
}: {
  activeThreadIndex: number;
  isCollapsed: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
      {Array.from({ length: 14 }).map((_, index) => {
        const isActive = index === activeThreadIndex;
        return (
          <div
            key={`placeholder-thread-${index}`}
            className={cn(
              'group flex items-center gap-2 rounded-[6px] px-2 py-1.5 transition',
              isActive ? 'bg-[#f1f5ff]' : 'hover:bg-zinc-100/80',
            )}
          >
            <button
              type="button"
              className={cn(
                'min-w-0 flex-1 truncate text-left text-[14px] leading-[1.4] transition',
                isActive ? 'text-[#17171c]' : 'text-[#75758a]',
                isCollapsed && 'sr-only',
              )}
              disabled
            >
              Tread title ....
            </button>
            {!isCollapsed ? (
              <button
                type="button"
                aria-label="删除会话"
                className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                disabled
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ThreadSidebar({
  sessions,
  activeSessionId,
  isRunning,
  runtimeStatus,
  isCollapsed,
  onToggleCollapse,
  onNewThread,
  onSelectThread,
  onDeleteThread,
}: ThreadSidebarProps) {
  const titleColumnClassName = isCollapsed ? 'sr-only' : 'min-w-0 flex-1';

  return (
    <aside
      className={cn(
        'flex shrink-0 border-zinc-200 bg-white text-zinc-700',
        'border-b md:h-screen md:flex-col md:border-b-0 md:border-r',
        isCollapsed ? 'md:w-[72px]' : 'md:w-[220px]',
      )}
    >
      <div className="flex h-full w-full flex-col px-4 pb-4 pt-4">
        <div className="flex items-center justify-between pb-8">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-white text-[34px] font-black leading-none tracking-[-0.08em] text-[#17171c]">
              G
            </div>
            {!isCollapsed ? <span className="sr-only">Dexter</span> : null}
          </div>

          <button
            type="button"
            aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={onToggleCollapse}
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <PanelLeftClose
              aria-hidden="true"
              className={cn('size-4 transition-transform', isCollapsed && 'rotate-180')}
            />
          </button>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={onNewThread}
          className={cn(
            'mb-8 flex items-center gap-3 rounded-[6px] px-1.5 py-3 text-left transition',
            isRunning ? 'cursor-not-allowed opacity-60' : 'hover:bg-zinc-50',
          )}
        >
          <SidebarIcon>
            <Plus aria-hidden="true" className="size-3.5" />
          </SidebarIcon>
          <span className={titleColumnClassName}>
            <span className="block text-[16px] leading-[1.4] text-[#75758a]">New Thread</span>
          </span>
        </button>

        <div className="mb-4 flex items-center gap-3 rounded-[6px] px-1.5 py-3 text-left transition">
          <SidebarIcon>
            <Inbox aria-hidden="true" className="size-3.5" />
          </SidebarIcon>
          <span className={titleColumnClassName}>
            <span className="block text-[16px] leading-[1.4] text-[#75758a]">History</span>
          </span>
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col gap-1 pb-2', isCollapsed && 'items-center')}>
          {sessions.length === 0 ? (
            <PlaceholderThreads activeThreadIndex={0} isCollapsed={isCollapsed} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 pt-1">
              {sessions.map((session, index) => {
                const isActive = session.sessionId === activeSessionId || (!activeSessionId && index === 0);
                return (
                  <div
                    key={session.sessionId}
                    className={cn(
                      'group flex items-center gap-2 rounded-[6px] px-3 py-1.5 transition',
                      isActive ? 'bg-[#f1f5ff]' : 'hover:bg-zinc-100/80',
                    )}
                  >
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => onSelectThread(session.sessionId)}
                      className={cn(
                        'min-w-0 flex-1 truncate text-left text-[14px] leading-[1.4] transition disabled:cursor-not-allowed',
                        isActive ? 'text-[#17171c]' : 'text-[#75758a]',
                        isCollapsed && 'sr-only',
                      )}
                    >
                      {session.title}
                    </button>
                    {!isCollapsed ? (
                      <button
                        type="button"
                        disabled={isRunning}
                        aria-label={`删除 ${session.title}`}
                        className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100"
                        onClick={() => {
                          if (confirm(`删除会话「${session.title}」？`)) {
                            onDeleteThread(session.sessionId);
                          }
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div
            className={cn(
              'inline-flex items-center rounded-full px-4 py-1.5 text-[12px] leading-none text-[#17171c]',
              runtimeStatus === 'Offline' ? 'bg-[#ffe4e4]' : 'bg-[#edfce9]',
            )}
          >
            {runtimeStatus === 'Checking' ? 'Checking' : runtimeStatus === 'Offline' ? 'Offline' : 'Connected'}
          </div>
        </div>
      </div>
    </aside>
  );
}
