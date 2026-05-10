import type { ThreadMessage } from '@assistant-ui/react';

export type AccountUser = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  preferredModel: string | null;
  preferredProvider: string | null;
  preferredTheme: string | null;
  localHistoryImportedAt: string | null;
};

export type AccountSessionSummary = {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  model: string;
  provider: string;
  messageCount: number;
};

export type AccountSessionSnapshot = AccountSessionSummary & {
  messages: ThreadMessage[];
};

type JsonRecord = Record<string, unknown>;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error((await response.text()) || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getCurrentAccount(): Promise<AccountUser | null> {
  const response = await fetch('/api/auth/me');
  if (response.status === 401) {
    return null;
  }

  const body = await parseJsonResponse<{ user: AccountUser }>(response);
  return body.user;
}

export async function loginAccount(email: string, password: string): Promise<AccountUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = await parseJsonResponse<{ user: AccountUser }>(response);
  return body.user;
}

export async function registerAccount(email: string, password: string, inviteCode: string): Promise<AccountUser> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, inviteCode }),
  });

  const body = await parseJsonResponse<{ user: AccountUser }>(response);
  return body.user;
}

export async function logoutAccount(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  await parseJsonResponse<{ ok: boolean }>(response);
}

export async function listAccountSessions(): Promise<AccountSessionSummary[]> {
  const response = await fetch('/api/account/sessions');
  const body = await parseJsonResponse<{ sessions: AccountSessionSummary[] }>(response);
  return body.sessions;
}

export async function loadAccountSession(sessionId: string): Promise<AccountSessionSnapshot | null> {
  const response = await fetch(`/api/account/sessions/${sessionId}`);
  if (response.status === 404) {
    return null;
  }

  const body = await parseJsonResponse<AccountSessionSnapshot>(response);
  return body;
}

export async function saveAccountSessionSnapshot(
  sessionId: string,
  snapshot: {
    title?: string | null;
    model?: string;
    provider?: string;
    createdAt?: string | null;
    lastActiveAt?: string | null;
    messages: ThreadMessage[];
  },
): Promise<AccountSessionSnapshot> {
  const response = await fetch(`/api/account/sessions/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });

  return parseJsonResponse<AccountSessionSnapshot>(response);
}

export async function deleteAccountSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/account/sessions/${sessionId}`, { method: 'DELETE' });
  await parseJsonResponse<{ ok: boolean }>(response);
}

export async function importLocalAccountHistory(payload: {
  sessions: Array<{
    sessionId: string;
    title?: string;
    createdAt?: string;
    lastActiveAt?: string;
    model?: string;
    provider?: string;
    messages: ThreadMessage[];
  }>;
  importedAt?: string;
}): Promise<AccountSessionSummary[]> {
  const response = await fetch('/api/account/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse<{ sessions: AccountSessionSummary[] }>(response);
  return body.sessions;
}

export async function fetchAccountSessionSummaries(): Promise<AccountSessionSummary[]> {
  return listAccountSessions();
}

