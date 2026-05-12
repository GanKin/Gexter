/**
 * ThreadSidebar - 会话侧边栏组件
 *
 * 功能：
 * - 显示应用图标和折叠/展开按钮
 * - 新建会话按钮
 * - 会话历史列表展示
 * - 切换和删除会话
 * - 运行时连接状态显示
 * - 响应式布局，支持折叠状态
 */

'use client';

import { useState, type ReactNode } from 'react';

import { ChevronRight, Trash2 } from 'lucide-react';
import appIcon from '@/app/slices/app-icon.svg';
import icoAddActive from '@/app/slices/ico-add-actived.svg';
import icoAdd from '@/app/slices/ico-add.svg';
import icoExpand from '@/app/slices/ico-expand.svg';
import icoInbox from '@/app/slices/ico-inbox.svg';

import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/lib/session-index';

/**
 * 运行时状态类型
 * - Checking: 正在检查连接状态
 * - Connected: 已连接到运行时
 * - Offline: 运行时离线
 */
type RuntimeStatus = 'Checking' | 'Connected' | 'Offline';

/**
 * ThreadSidebar 组件的属性类型
 */
type ThreadSidebarProps = {
  /** 会话列表 */
  sessions: SessionSummary[];
  /** 当前激活的会话 ID */
  activeSessionId: string | null;
  /** 是否有会话正在运行 */
  isRunning: boolean;
  /** 运行时连接状态 */
  runtimeStatus: RuntimeStatus;
  /** 侧边栏是否折叠 */
  isCollapsed: boolean;
  /** 切换折叠状态回调 */
  onToggleCollapse: () => void;
  /** 新建会话回调 */
  onNewThread: () => void;
  /** 选择会话回调 */
  onSelectThread: (sessionId: string) => void;
  /** 删除会话回调 */
  onDeleteThread: (sessionId: string) => void;
};

/**
 * SidebarIcon - 侧边栏图标容器
 * 提供统一的图标样式和尺寸
 */
function SidebarIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('inline-flex size-6 items-center justify-center', className)}>{children}</span>;
}

/**
 * SliceIcon - SVG 图标渲染组件
 * 用于渲染 SVG sprite 图标，保持统一的样式
 */
function SliceIcon({
  asset,
  className,
}: {
  asset: { src: string; width: number; height: number };
  className?: string;
}) {
  return <img alt="" aria-hidden="true" className={className} src={asset.src} width={asset.width} height={asset.height} />;
}

/**
 * PlaceholderThreads - 占位会话列表
 * 在没有实际会话时显示占位内容，提供视觉预览
 */
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
              'group flex items-center gap-2 rounded-[10px] px-2 py-1.5 transition',
              isActive ? 'bg-[#eef3fb]' : 'hover:bg-white',
            )}
          >
            <button
              type="button"
              className={cn(
                'min-w-0 flex-1 truncate text-left text-[14px] leading-[1.4] transition',
                isActive ? 'text-[#1d2433]' : 'text-[#8a93a3]',
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
                className="rounded-md p-1 text-[#a0a8b6] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
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

/**
 * ThreadSidebar - 会话侧边栏主组件
 * 提供完整的侧边栏界面，包括应用头部、新建按钮、会话列表和状态指示器
 */
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
  // 根据折叠状态设置标题列的样式类名
  const titleColumnClassName = isCollapsed ? 'sr-only' : 'min-w-0 flex-1';
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex shrink-0 border-[#e8edf5] bg-[#fcfcfd] text-zinc-700 shadow-[0_1px_0_rgba(15,23,42,0.02)]',
        'border-b md:h-dvh md:flex-col md:border-b-0 md:border-r',
        isCollapsed ? 'md:w-[72px]' : 'md:w-[220px]',
      )}
    >
      <div className="flex h-full w-full flex-col px-4 pb-4 pt-4">
        <div className="flex items-center justify-between pb-8">
          <div className="flex items-center gap-3">
            <SliceIcon asset={appIcon} className="block size-11" />
            {!isCollapsed ? <span className="sr-only">Dexter</span> : null}
          </div>

          <button
            type="button"
            aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={onToggleCollapse}
            className="inline-flex size-6 items-center justify-center rounded-md text-[#9ca3af] transition hover:bg-white hover:text-[#1d2433]"
          >
            <SliceIcon asset={icoExpand} className={cn('block size-6 transition-transform', isCollapsed && 'rotate-180')} />
          </button>
        </div>

        <button
          type="button"
          onClick={onNewThread}
          aria-busy={isRunning}
          className={cn(
            'group mb-2 flex items-center gap-3 rounded-[10px] px-2 py-3 text-left transition-colors duration-150',
            isRunning
              ? 'hover:bg-[#5570eb]/90 hover:text-[#dbe6ff] focus-visible:bg-[#5570eb] focus-visible:text-[#dbe6ff]'
              : 'hover:bg-[#5570eb] hover:text-[#dbe6ff] focus-visible:bg-[#5570eb] focus-visible:text-[#dbe6ff]',
          )}
        >
          <SidebarIcon className="shrink-0 text-[#7f88a0] transition-colors duration-150 group-hover:text-[#dbe6ff]">
            <SliceIcon asset={icoAdd} className="block size-6 group-hover:hidden" />
            <SliceIcon asset={icoAddActive} className="hidden size-6 group-hover:block" />
          </SidebarIcon>
          <span className={titleColumnClassName}>
            <span className="block text-[16px] leading-[1.4] text-[#75758a] transition-colors duration-150 group-hover:text-[#dbe6ff]">
              New Thread
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-expanded={!isHistoryCollapsed}
          onClick={() => setIsHistoryCollapsed((current) => !current)}
          className="mb-4 flex w-full items-center gap-3 rounded-[6px] px-1.5 py-3 text-left transition hover:bg-white focus-visible:bg-white"
        >
          <SidebarIcon>
            <SliceIcon asset={icoInbox} className="block size-6" />
          </SidebarIcon>
          <span className={titleColumnClassName}>
            <span className="block text-[16px] leading-[1.4] text-[#75758a]">History</span>
          </span>
          {!isCollapsed ? (
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'ml-auto size-4 text-[#9ca3af] transition-transform duration-150',
                !isHistoryCollapsed && 'rotate-90',
              )}
            />
          ) : null}
        </button>

        {isHistoryCollapsed ? null : (
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
                        'group flex items-center gap-2 rounded-[10px] px-3 py-1.5 transition',
                        isActive ? 'bg-[#eef3fb]' : 'hover:bg-white',
                      )}
                    >
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => onSelectThread(session.sessionId)}
                        className={cn(
                          'min-w-0 flex-1 truncate text-left text-[14px] leading-[1.4] transition disabled:cursor-not-allowed',
                          isActive ? 'text-[#1d2433]' : 'text-[#8a93a3]',
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
                          className="rounded-md p-1 text-[#a0a8b6] opacity-0 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100"
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
        )}

        <div className="mt-auto pt-3">
          <div
            className={cn(
              'inline-flex items-center rounded-full px-4 py-1.5 text-[12px] leading-none text-[#1d2433]',
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
