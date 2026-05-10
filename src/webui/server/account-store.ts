import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { newDb } from 'pg-mem';

import type { ThreadMessage } from '@assistant-ui/react';

import { buildSessionTitle } from '@/lib/session-index';

type DbValue = string | number | boolean | null;

type DbRow = Record<string, unknown>;

type DbClient = {
  all<T extends DbRow>(sql: string, params?: DbValue[]): Promise<T[]>;
  get<T extends DbRow>(sql: string, params?: DbValue[]): Promise<T | null>;
  run(sql: string, params?: DbValue[]): Promise<void>;
  close(): Promise<void>;
};

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

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  preferred_model: string | null;
  preferred_provider: string | null;
  preferred_theme: string | null;
  local_history_imported_at: string | null;
};

type InviteCodeRow = {
  code: string;
  created_at: string;
  used_by_user_id: string | null;
  used_at: string | null;
  expires_at: string | null;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_active_at: string;
  model: string;
  provider: string;
  message_count: number;
};

type MessageRow = {
  session_id: string;
  user_id: string;
  message_id: string;
  order_index: number;
  role: string;
  status: string;
  message_json: string;
  created_at: string;
};

type AuthSessionRow = {
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
};

const AUTH_COOKIE_NAME = 'dexter-auth';
const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_INVITE_CODE = 'DEXTER-DEV-INVITE';
const SCHEMA_STATEMENTS = [
  `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  preferred_model TEXT,
  preferred_provider TEXT,
  preferred_theme TEXT,
  local_history_imported_at TEXT
)
  `,
  `
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  used_by_user_id TEXT,
  used_at TEXT,
  expires_at TEXT
)
  `,
  `
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
)
  `,
  `
CREATE TABLE IF NOT EXISTS account_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  message_count INTEGER NOT NULL
)
  `,
  `
CREATE TABLE IF NOT EXISTS account_messages (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  message_json TEXT NOT NULL,
  created_at TEXT NOT NULL
)
  `,
  `
CREATE INDEX IF NOT EXISTS idx_account_sessions_user_last_active
  ON account_sessions(user_id, last_active_at DESC)
  `,
  `
CREATE INDEX IF NOT EXISTS idx_account_messages_session_order
  ON account_messages(session_id, order_index ASC)
  `,
];

let dbClientPromise: Promise<DbClient> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeInviteCode(code: string): string {
  return code.trim();
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  const derived = scryptSync(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (candidate.byteLength !== expected.byteLength) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toPostgresSql(sql: string): string {
  let parameterIndex = 0;
  return sql.replace(/\?/g, () => {
    parameterIndex += 1;
    return `$${parameterIndex}`;
  });
}

function randomId(prefix: string): string {
  return `${prefix}-${randomBytes(16).toString('hex')}`;
}

function readSessionMessageText(message: ThreadMessage): string {
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

function normalizeStatus(status: ThreadMessage['status'] | undefined): string {
  if (!status) {
    return 'complete';
  }

  if (status.type === 'complete') {
    return 'complete';
  }

  if (status.type === 'incomplete') {
    return `incomplete:${status.reason ?? 'unknown'}`;
  }

  return status.type;
}

function normalizeMessageForStorage(message: ThreadMessage): string {
  return JSON.stringify(message);
}

function normalizeStoredMessage(message: MessageRow): ThreadMessage {
  try {
    const parsed = JSON.parse(message.message_json) as ThreadMessage;
    const status = parsed.status;

    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      status:
        status && typeof status === 'object'
          ? status.type === 'running' || status.type === 'requires-action'
            ? ({ type: 'incomplete', reason: 'cancelled' } as ThreadMessage['status'])
            : (status as ThreadMessage['status'])
          : ({ type: 'complete', reason: 'stop' } as ThreadMessage['status']),
    } as unknown as ThreadMessage;
  } catch {
    return {
      id: message.message_id,
      role: message.role as ThreadMessage['role'],
      content: [],
      createdAt: new Date(message.created_at),
      status: { type: 'complete', reason: 'stop' } as ThreadMessage['status'],
      metadata: {
        unstable_state: null,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {},
      },
    } as unknown as ThreadMessage;
  }
}

function normalizeUserRow(row: UserRow): AccountUser {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preferredModel: row.preferred_model,
    preferredProvider: row.preferred_provider,
    preferredTheme: row.preferred_theme,
    localHistoryImportedAt: row.local_history_imported_at,
  };
}

function normalizeSessionRow(row: SessionRow): AccountSessionSummary {
  return {
    sessionId: row.session_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
    model: row.model,
    provider: row.provider,
    messageCount: Number(row.message_count ?? 0),
  };
}

function createPostgresClient(): DbClient {
  const connectionString =
    process.env.DATABASE_URL?.trim() ||
    process.env.DEXTER_ACCOUNT_DATABASE_URL?.trim() ||
    (process.env.NODE_ENV === 'production'
      ? null
      : 'postgres://dexter:dexter@127.0.0.1:15432/dexter');

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the Postgres account store');
  }

  const pool = new Pool({ connectionString });

  return {
    async all<T extends DbRow>(sql: string, params: DbValue[] = []): Promise<T[]> {
      const result = await pool.query(toPostgresSql(sql), params);
      return result.rows as T[];
    },
    async get<T extends DbRow>(sql: string, params: DbValue[] = []): Promise<T | null> {
      const result = await pool.query(toPostgresSql(sql), params);
      return (result.rows[0] as T | undefined) ?? null;
    },
    async run(sql: string, params: DbValue[] = []): Promise<void> {
      await pool.query(toPostgresSql(sql), params);
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

function createTestPostgresClient(): DbClient {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  (db as typeof db & { options: { noAstCoverageCheck?: boolean } }).options.noAstCoverageCheck = true;
  const { Pool: MemoryPool } = db.adapters.createPg();
  const pool = new MemoryPool();

  return {
    async all<T extends DbRow>(sql: string, params: DbValue[] = []): Promise<T[]> {
      const result = await pool.query(toPostgresSql(sql), params);
      return result.rows as T[];
    },
    async get<T extends DbRow>(sql: string, params: DbValue[] = []): Promise<T | null> {
      const result = await pool.query(toPostgresSql(sql), params);
      return (result.rows[0] as T | undefined) ?? null;
    },
    async run(sql: string, params: DbValue[] = []): Promise<void> {
      await pool.query(toPostgresSql(sql), params);
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

async function getDbClient(): Promise<DbClient> {
  if (!dbClientPromise) {
    if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL?.trim()) {
      dbClientPromise = Promise.resolve(createTestPostgresClient());
    } else {
      dbClientPromise = Promise.resolve(createPostgresClient());
    }
  }

  return dbClientPromise;
}

async function ensureInviteCodes(client: DbClient): Promise<void> {
  const existing = await client.get<{ count: number }>('SELECT COUNT(*) as count FROM invite_codes');
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const codes = (process.env.DEXTER_INVITE_CODES ?? process.env.DEXTER_INVITE_CODE ?? DEFAULT_INVITE_CODE)
    .split(',')
    .map((code) => normalizeInviteCode(code))
    .filter(Boolean);

  const createdAt = nowIso();
  for (const code of codes) {
    await client.run(
      'INSERT INTO invite_codes (code, created_at, used_by_user_id, used_at, expires_at) VALUES (?, ?, NULL, NULL, NULL) ON CONFLICT(code) DO NOTHING',
      [code, createdAt],
    );
  }
}

async function initializeSchema(): Promise<DbClient> {
  const client = await getDbClient();
  for (const statement of SCHEMA_STATEMENTS) {
    await client.run(statement);
  }
  await ensureInviteCodes(client);
  return client;
}

export async function initializeAccountStore(): Promise<void> {
  await initializeSchema();
}

export async function closeAccountStoreForTests(): Promise<void> {
  if (!dbClientPromise) {
    return;
  }

  const client = await dbClientPromise;
  await client.close();
  dbClientPromise = null;
}

export function buildAuthCookie(value: string): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function clearAuthCookie(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) {
    return null;
  }

  for (const segment of header.split(';')) {
    const [rawKey, ...rawValue] = segment.trim().split('=');
    if (rawKey === name) {
      return rawValue.join('=');
    }
  }

  return null;
}

async function getUserBySessionToken(token: string): Promise<AccountUser | null> {
  const client = await initializeSchema();
  const tokenHash = sha256(token);
  const now = nowIso();

  const session = await client.get<AuthSessionRow>(
    'SELECT token_hash, user_id, created_at, expires_at, last_seen_at FROM auth_sessions WHERE token_hash = ?',
    [tokenHash],
  );

  if (!session) {
    return null;
  }

  if (session.expires_at <= now) {
    await client.run('DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }

  await client.run('UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?', [now, tokenHash]);

  const user = await client.get<UserRow>(
    'SELECT id, email, password_hash, created_at, updated_at, preferred_model, preferred_provider, preferred_theme, local_history_imported_at FROM users WHERE id = ?',
    [session.user_id],
  );

  return user ? normalizeUserRow(user) : null;
}

async function getOrCreateTestUser(): Promise<AccountUser> {
  const client = await initializeSchema();
  const now = nowIso();
  const existing = await client.get<UserRow>('SELECT * FROM users WHERE id = ?', ['usr-test']);
  if (existing) {
    return normalizeUserRow(existing);
  }

  await client.run(
    `INSERT INTO users (
      id, email, password_hash, created_at, updated_at, preferred_model, preferred_provider, preferred_theme, local_history_imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ['usr-test', 'test@dexter.local', hashPassword('test-password'), now, now, 'gpt-5.4', 'openai', 'light'],
  );

  const created = await client.get<UserRow>('SELECT * FROM users WHERE id = ?', ['usr-test']);
  if (!created) {
    throw new Error('Failed to create test user');
  }
  return normalizeUserRow(created);
}

export async function getCurrentUser(request: Request): Promise<AccountUser | null> {
  const token = readCookie(request, AUTH_COOKIE_NAME);
  if (!token) {
    if (process.env.NODE_ENV === 'test') {
      return getOrCreateTestUser();
    }
    return null;
  }

  return getUserBySessionToken(token);
}

export async function requireCurrentUser(request: Request): Promise<AccountUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return user;
}

export async function registerAccount(params: {
  email: string;
  password: string;
  inviteCode: string;
}): Promise<{ user: AccountUser; token: string }> {
  const client = await initializeSchema();
  const email = normalizeEmail(params.email);
  const inviteCode = normalizeInviteCode(params.inviteCode);
  const passwordHash = hashPassword(params.password);
  const now = nowIso();

  const invite = await client.get<InviteCodeRow>(
    'SELECT code, created_at, used_by_user_id, used_at, expires_at FROM invite_codes WHERE code = ?',
    [inviteCode],
  );

  if (!invite) {
    throw new Response('邀请码无效。', { status: 400 });
  }

  if (invite.expires_at && invite.expires_at <= now) {
    throw new Response('邀请码已过期。', { status: 400 });
  }

  if (invite.used_by_user_id) {
    throw new Response('邀请码已被使用。', { status: 400 });
  }

  const existing = await client.get<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  if (existing) {
    throw new Response('该邮箱已注册。', { status: 409 });
  }

  const userId = randomId('usr');
  await client.run(
    `INSERT INTO users (
      id, email, password_hash, created_at, updated_at, preferred_model, preferred_provider, preferred_theme, local_history_imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [userId, email, passwordHash, now, now, 'gpt-5.4', 'openai', 'light'],
  );
  await client.run(
    'UPDATE invite_codes SET used_by_user_id = ?, used_at = ? WHERE code = ?',
    [userId, now, inviteCode],
  );

  const token = randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  await client.run(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
    [tokenHash, userId, now, new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString(), now],
  );

  const user = await client.get<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new Response('用户创建失败。', { status: 500 });
  }

  return { user: normalizeUserRow(user), token };
}

export async function loginAccount(params: {
  email: string;
  password: string;
}): Promise<{ user: AccountUser; token: string }> {
  const client = await initializeSchema();
  const email = normalizeEmail(params.email);
  const now = nowIso();

  const user = await client.get<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !verifyPassword(params.password, user.password_hash)) {
    throw new Response('邮箱或密码错误。', { status: 401 });
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  await client.run(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
    [tokenHash, user.id, now, new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString(), now],
  );

  return { user: normalizeUserRow(user), token };
}

export async function logoutAccount(request: Request): Promise<void> {
  const client = await initializeSchema();
  const token = readCookie(request, AUTH_COOKIE_NAME);
  if (!token) {
    return;
  }

  await client.run('DELETE FROM auth_sessions WHERE token_hash = ?', [sha256(token)]);
}

export async function getAccountProfile(userId: string): Promise<AccountUser | null> {
  const client = await initializeSchema();
  const user = await client.get<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  return user ? normalizeUserRow(user) : null;
}

export async function setLocalHistoryImportedAt(userId: string, importedAt: string | null): Promise<void> {
  const client = await initializeSchema();
  await client.run('UPDATE users SET local_history_imported_at = ?, updated_at = ? WHERE id = ?', [
    importedAt,
    nowIso(),
    userId,
  ]);
}

export async function upsertPreferredModel(
  userId: string,
  params: { model: string; provider: string },
): Promise<void> {
  const client = await initializeSchema();
  await client.run(
    'UPDATE users SET preferred_model = ?, preferred_provider = ?, updated_at = ? WHERE id = ?',
    [params.model, params.provider, nowIso(), userId],
  );
}

export async function listAccountSessions(userId: string): Promise<AccountSessionSummary[]> {
  const client = await initializeSchema();
  const rows = await client.all<SessionRow>(
    'SELECT session_id, user_id, title, created_at, updated_at, last_active_at, model, provider, message_count FROM account_sessions WHERE user_id = ? ORDER BY last_active_at DESC',
    [userId],
  );
  return rows.map(normalizeSessionRow);
}

export async function loadAccountSessionSnapshot(
  userId: string,
  sessionId: string,
): Promise<AccountSessionSnapshot | null> {
  const client = await initializeSchema();
  const session = await client.get<SessionRow>(
    'SELECT session_id, user_id, title, created_at, updated_at, last_active_at, model, provider, message_count FROM account_sessions WHERE user_id = ? AND session_id = ?',
    [userId, sessionId],
  );

  if (!session) {
    return null;
  }

  const messages = await client.all<MessageRow>(
    'SELECT session_id, user_id, message_id, order_index, role, status, message_json, created_at FROM account_messages WHERE user_id = ? AND session_id = ? ORDER BY order_index ASC',
    [userId, sessionId],
  );

  return {
    ...normalizeSessionRow(session),
    messages: messages.map(normalizeStoredMessage),
  };
}

export async function loadAccountSessionMessages(
  userId: string,
  sessionId: string,
): Promise<ThreadMessage[]> {
  const snapshot = await loadAccountSessionSnapshot(userId, sessionId);
  return snapshot?.messages ?? [];
}

function deriveSessionTitle(existingTitle: string | null | undefined, messages: ThreadMessage[]): string {
  if (existingTitle && existingTitle.trim().length > 0 && existingTitle !== '新会话') {
    return existingTitle;
  }

  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) {
    return '新会话';
  }

  const text = readSessionMessageText(firstUserMessage);
  return buildSessionTitle(text);
}

function deriveModel(model: string | null | undefined): string {
  return model && model.trim().length > 0 ? model.trim() : 'gpt-5.4';
}

function deriveProvider(provider: string | null | undefined, model: string): string {
  if (provider && provider.trim().length > 0) {
    return provider.trim();
  }

  if (model.startsWith('claude-')) {
    return 'anthropic';
  }

  if (model.startsWith('gemini-')) {
    return 'google';
  }

  if (model.startsWith('grok-') || model.startsWith('xai-')) {
    return 'xai';
  }

  if (model.startsWith('ollama:') || model.startsWith('local:')) {
    return 'local';
  }

  return 'openai';
}

export async function upsertAccountSessionSnapshot(params: {
  userId: string;
  sessionId: string;
  messages: ThreadMessage[];
  model?: string;
  provider?: string;
  title?: string | null;
  createdAt?: string | null;
  lastActiveAt?: string | null;
}): Promise<AccountSessionSummary> {
  const client = await initializeSchema();
  const now = nowIso();
  const existing = await client.get<SessionRow>(
    'SELECT session_id, user_id, title, created_at, updated_at, last_active_at, model, provider, message_count FROM account_sessions WHERE user_id = ? AND session_id = ?',
    [params.userId, params.sessionId],
  );
  const title = deriveSessionTitle(params.title ?? existing?.title, params.messages);
  const model = deriveModel(params.model ?? existing?.model ?? null);
  const provider = deriveProvider(params.provider ?? existing?.provider ?? null, model);
  const createdAt = params.createdAt ?? existing?.created_at ?? now;
  const lastActiveAt = params.lastActiveAt ?? now;

  await client.run(
    `INSERT INTO account_sessions (
      session_id, user_id, title, created_at, updated_at, last_active_at, model, provider, message_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      user_id = excluded.user_id,
      title = excluded.title,
      updated_at = excluded.updated_at,
      last_active_at = excluded.last_active_at,
      model = excluded.model,
      provider = excluded.provider,
      message_count = excluded.message_count`,
    [params.sessionId, params.userId, title, createdAt, now, lastActiveAt, model, provider, params.messages.length],
  );

  await client.run('DELETE FROM account_messages WHERE user_id = ? AND session_id = ?', [params.userId, params.sessionId]);

  for (const [orderIndex, message] of params.messages.entries()) {
    await client.run(
      `INSERT INTO account_messages (
        message_id, session_id, user_id, order_index, role, status, message_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        params.sessionId,
        params.userId,
        orderIndex,
        message.role,
        normalizeStatus(message.status),
        normalizeMessageForStorage(message),
        message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
      ],
    );
  }

  await upsertPreferredModel(params.userId, { model, provider });

  return {
    sessionId: params.sessionId,
    title,
    createdAt,
    updatedAt: now,
    lastActiveAt,
    model,
    provider,
    messageCount: params.messages.length,
  };
}

export async function deleteAccountSession(userId: string, sessionId: string): Promise<void> {
  const client = await initializeSchema();
  await client.run('DELETE FROM account_messages WHERE user_id = ? AND session_id = ?', [userId, sessionId]);
  await client.run('DELETE FROM account_sessions WHERE user_id = ? AND session_id = ?', [userId, sessionId]);
}

export async function importLocalHistory(params: {
  userId: string;
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
  const summaries: AccountSessionSummary[] = [];
  for (const session of params.sessions) {
    const summary = await upsertAccountSessionSnapshot({
      userId: params.userId,
      sessionId: session.sessionId,
      title: session.title ?? null,
      createdAt: session.createdAt ?? null,
      lastActiveAt: session.lastActiveAt ?? params.importedAt ?? null,
      model: session.model,
      provider: session.provider,
      messages: session.messages,
    });
    summaries.push(summary);
  }

  if (params.importedAt) {
    await setLocalHistoryImportedAt(params.userId, params.importedAt);
  }

  return summaries;
}

export async function ensureAccountSessionOwnership(userId: string, sessionId: string): Promise<boolean> {
  const client = await initializeSchema();
  const existing = await client.get<{ session_id: string }>(
    'SELECT session_id FROM account_sessions WHERE user_id = ? AND session_id = ?',
    [userId, sessionId],
  );
  return Boolean(existing);
}

export async function recordLegacyImportIfNeeded(userId: string): Promise<void> {
  const user = await getAccountProfile(userId);
  if (user && !user.localHistoryImportedAt) {
    await setLocalHistoryImportedAt(userId, nowIso());
  }
}

export async function closeAccountDb(): Promise<void> {
  if (!dbClientPromise) {
    return;
  }

  const client = await dbClientPromise;
  await client.close();
  dbClientPromise = null;
}

export { AUTH_COOKIE_NAME, AUTH_SESSION_TTL_MS };
