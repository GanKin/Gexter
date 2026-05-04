import type { WebRuntimeSession } from './types';

export const sessions = new Map<string, WebRuntimeSession>();

export function registerSession(session: WebRuntimeSession): void {
  sessions.set(session.id, session);
}

export function getSession(id: string): WebRuntimeSession | undefined {
  return sessions.get(id);
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}
