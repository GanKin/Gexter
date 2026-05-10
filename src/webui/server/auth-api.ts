import {
  buildAuthCookie,
  clearAuthCookie,
  getCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
} from './account-store';

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  inviteCode?: unknown;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function parseJsonBody<T>(body: string | null): T | null {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function responseFromError(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Response(message || 'Unexpected error', { status: 500 });
}

export async function handleAuthMeRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  return Response.json({ user });
}

export async function handleAuthRegisterRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = parseJsonBody<RegisterBody>(await request.text());
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const inviteCode = typeof body?.inviteCode === 'string' ? body.inviteCode : '';

  if (!email.trim() || !password.trim() || !inviteCode.trim()) {
    return new Response('Missing required fields', { status: 400 });
  }

  try {
    const { user, token } = await registerAccount({ email, password, inviteCode });
    return Response.json(
      { user },
      { headers: { 'Set-Cookie': buildAuthCookie(token) } },
    );
  } catch (error) {
    return responseFromError(error);
  }
}

export async function handleAuthLoginRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = parseJsonBody<LoginBody>(await request.text());
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email.trim() || !password.trim()) {
    return new Response('Missing required fields', { status: 400 });
  }

  try {
    const { user, token } = await loginAccount({ email, password });
    return Response.json(
      { user },
      { headers: { 'Set-Cookie': buildAuthCookie(token) } },
    );
  } catch (error) {
    return responseFromError(error);
  }
}

export async function handleAuthLogoutRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  await logoutAccount(request);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearAuthCookie() } });
}

