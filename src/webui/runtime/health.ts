import { getSetting } from '../../utils/config';
import type { RuntimeHealth } from './types';

function getDefaultWebRuntimeModel(): string {
  return process.env.OPENAI_MODEL?.trim() || getSetting('modelId', 'gpt-5.4');
}

export async function getRuntimeHealth(): Promise<RuntimeHealth> {
  return {
    ok: true,
    runtime: 'dexter',
    mode: 'webui',
    model: getDefaultWebRuntimeModel(),
    gatewayCompatible: true,
  };
}
