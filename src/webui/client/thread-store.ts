import type { ThreadMessage } from '@assistant-ui/react';

const THREAD_MESSAGES_PREFIX = 'dexter-thread-messages:';
const MAX_MESSAGES_PER_THREAD = 500;

const memoryMessages = new Map<string, ThreadMessage[]>();

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(): BrowserStorage | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }

  return null;
}

function cloneMessage(message: ThreadMessage): ThreadMessage {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
    content: message.content.map((part) => ({ ...part })) as ThreadMessage['content'],
    metadata: {
      ...message.metadata,
      unstable_annotations: [...(message.metadata.unstable_annotations ?? [])],
      unstable_data: [...(message.metadata.unstable_data ?? [])],
      steps: [...(message.metadata.steps ?? [])],
      custom: { ...(message.metadata.custom ?? {}) },
    },
  } as ThreadMessage;
}

function normalizeMessageForRestore(message: ThreadMessage): ThreadMessage {
  const next = cloneMessage(message);

  if (next.role !== 'assistant') {
    return next;
  }

  if (next.status.type === 'running' || next.status.type === 'requires-action') {
    return {
      ...next,
      status: { type: 'incomplete', reason: 'cancelled' },
    };
  }

  return next;
}

function storageKey(sessionId: string): string {
  return `${THREAD_MESSAGES_PREFIX}${sessionId}`;
}

function parseMessages(raw: string | null): ThreadMessage[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((message): message is ThreadMessage => {
        return Boolean(
          message &&
            typeof message === 'object' &&
            typeof (message as Partial<ThreadMessage>).id === 'string' &&
            typeof (message as Partial<ThreadMessage>).role === 'string' &&
            Array.isArray((message as Partial<ThreadMessage>).content),
        );
      })
      .map((message) =>
        normalizeMessageForRestore({
          ...message,
          createdAt: new Date(message.createdAt),
        }),
      );
  } catch {
    return [];
  }
}

export async function saveThreadMessages(sessionId: string, messages: readonly ThreadMessage[]): Promise<void> {
  const normalized = messages.slice(-MAX_MESSAGES_PER_THREAD).map((message) => normalizeMessageForRestore(message));
  memoryMessages.set(sessionId, normalized.map(cloneMessage));

  try {
    getStorage()?.setItem(storageKey(sessionId), JSON.stringify(normalized));
  } catch {
    // Best-effort browser persistence.
  }
}

export async function loadThreadMessages(sessionId: string): Promise<ThreadMessage[]> {
  const stored = getStorage()?.getItem(storageKey(sessionId));
  if (stored !== null && stored !== undefined) {
    return parseMessages(stored);
  }

  return (memoryMessages.get(sessionId) ?? []).map(normalizeMessageForRestore);
}

export async function deleteThreadMessages(sessionId: string): Promise<void> {
  memoryMessages.delete(sessionId);

  try {
    getStorage()?.removeItem(storageKey(sessionId));
  } catch {
    // Best-effort browser persistence.
  }
}

export function resetThreadStoreForTests(): void {
  memoryMessages.clear();
}
