'use client';

import { useEffect } from 'react';

type ShortcutActions = {
  onFocusInput: () => void;
  onNewSession: () => void;
  onPrevSession: () => void;
  onNextSession: () => void;
  onEscape: () => void;
};

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        actions.onFocusInput();
        return;
      }

      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        actions.onNewSession();
        return;
      }

      if (mod && event.key === '[') {
        event.preventDefault();
        actions.onPrevSession();
        return;
      }

      if (mod && event.key === ']') {
        event.preventDefault();
        actions.onNextSession();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        actions.onEscape();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [actions]);
}
