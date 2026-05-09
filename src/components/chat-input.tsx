'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatInputProps = {
  onSend: (query: string) => void;
  disabled: boolean;
  onAbort?: () => void;
};

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) {
      return;
    }

    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-3 border-t border-border/60 bg-[#f7f7f4] p-4 backdrop-blur">
      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Dexter about markets, filings, or companies..."
          disabled={disabled}
          className="min-h-[80px] max-h-[200px] resize-y border-border/80 bg-[#f7f7f4]"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {disabled ? 'Agent is thinking...' : 'Enter 换行，Shift+Enter 发送'}
          </p>
          <Button type="button" onClick={submit} disabled={disabled || !input.trim()}>
            <Send aria-hidden="true" data-icon="inline-start" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
