import {
  handleCreateSessionRequest,
  handleRuntimeHealthRequest,
  handleSessionAbortRequest,
  handleSessionApproveRequest,
  handleSessionChatRequest,
  handleSessionModelRequest,
} from '../runtime/api';
import {
  handleAuthLoginRequest,
  handleAuthLogoutRequest,
  handleAuthMeRequest,
  handleAuthRegisterRequest,
} from './auth-api';
import {
  handleAccountImportRequest,
  handleAccountSessionRequest,
  handleAccountSessionsListRequest,
} from './account-api';

export async function handleWebUiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/runtime/health') {
    return handleRuntimeHealthRequest(req);
  }

  if (url.pathname === '/api/auth/me') {
    return handleAuthMeRequest(req);
  }

  if (url.pathname === '/api/auth/login') {
    return handleAuthLoginRequest(req);
  }

  if (url.pathname === '/api/auth/logout') {
    return handleAuthLogoutRequest(req);
  }

  if (url.pathname === '/api/auth/register') {
    return handleAuthRegisterRequest(req);
  }

  if (url.pathname === '/api/account/sessions') {
    if (req.method === 'GET') {
      return handleAccountSessionsListRequest(req);
    }
  }

  if (url.pathname === '/api/account/import') {
    return handleAccountImportRequest(req);
  }

  const accountSessionMatch = url.pathname.match(/^\/api\/account\/sessions\/([^/]+)$/);
  if (accountSessionMatch?.[1]) {
    return handleAccountSessionRequest(req, decodeURIComponent(accountSessionMatch[1]));
  }

  if (url.pathname === '/api/runtime/sessions') {
    return handleCreateSessionRequest(req);
  }

  const chatMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/chat$/);
  if (chatMatch?.[1]) {
    return handleSessionChatRequest(req, decodeURIComponent(chatMatch[1]));
  }

  const modelMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/model$/);
  if (modelMatch?.[1]) {
    return handleSessionModelRequest(req, decodeURIComponent(modelMatch[1]));
  }

  const approveMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/approve$/);
  if (approveMatch?.[1]) {
    return handleSessionApproveRequest(req, decodeURIComponent(approveMatch[1]));
  }

  const abortMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/abort$/);
  if (abortMatch?.[1]) {
    return handleSessionAbortRequest(req, decodeURIComponent(abortMatch[1]));
  }

  return new Response('Not found', { status: 404 });
}
