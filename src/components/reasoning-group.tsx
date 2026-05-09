'use client';

import { useEffect, useState } from 'react';
import { Brain, ChevronRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type ReasoningGroupProps = {
  message: string;
  isActive: boolean;
  placeholder?: string;
  className?: string;
};

export function ReasoningGroup({
  message,
  isActive,
  placeholder = '正在思考...',
  className,
}: ReasoningGroupProps) {
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    setOpen(isActive);
  }, [isActive]);

  const hasMessage = message.trim().length > 0;

  return (
    <details
      className={cn('group mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-[#f7f7f4] shadow-sm', className)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm text-zinc-700 outline-none transition hover:bg-white/60 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500">
          <Brain aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="font-medium">Reasoning</span>
        <span className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400 transition-transform duration-200 group-open:rotate-90">
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </span>
      </summary>
      <div className="border-t border-zinc-200 px-4 py-3">
        {hasMessage ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-zinc-500">
            {message}
          </pre>
        ) : (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            <span>{placeholder}</span>
          </div>
        )}
      </div>
    </details>
  );
}
