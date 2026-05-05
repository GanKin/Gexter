import { handleWebUiRequest } from './routes';

const hostname = process.env.DEXTER_WEBUI_HOST ?? '127.0.0.1';

Bun.serve({
  hostname,
  port: Number(process.env.DEXTER_WEBUI_PORT ?? 5174),
  fetch: handleWebUiRequest,
});
