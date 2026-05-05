import {
  handleCreateSessionRequest,
  handleRuntimeHealthRequest,
  handleSessionAbortRequest,
  handleSessionApproveRequest,
  handleSessionChatRequest,
  handleSessionModelRequest,
} from '../runtime/api';

export async function handleWebUiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/runtime/health') {
    return handleRuntimeHealthRequest(req);
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
