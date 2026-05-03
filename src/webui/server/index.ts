import { handleWebUiRequest } from './routes';

Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.DEXTER_WEBUI_PORT ?? 5174),
  fetch: handleWebUiRequest,
});
