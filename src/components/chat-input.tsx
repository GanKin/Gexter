'use client';

import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatInputProps = {
  onSend: (query: string) => void;
  onAbort?: () => void;
  disabled: boolean;
};

export type ChatInputHandle = {
  focus: () => void;
};

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onAbort, disabled }: ChatInputProps,
  ref,
) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) {
      return;
    }

    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-3 border-t border-border/60 bg-background/80 p-4 backdrop-blur">
      {disabled ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Agent is thinking...</p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setInput('');
              onAbort?.();
            }}
          >
            <Square aria-hidden="true" data-icon="inline-start" />
            Stop
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Dexter about markets, filings, or companies..."
            disabled={disabled}
            className="min-h-[80px] max-h-[200px] resize-y border-border/80 bg-background/95"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-xs text-muted-foreground md:block">Enter 发送，Shift+Enter 换行 · ⌘K 聚焦 · ⌘N 新建</p>
            <Button type="button" onClick={submit} disabled={disabled || !input.trim()}>
              <Send aria-hidden="true" data-icon="inline-start" />
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
