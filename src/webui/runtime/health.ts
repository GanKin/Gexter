import { getSetting } from '../../utils/config';
import type { RuntimeHealth } from './types';

export async function getRuntimeHealth(): Promise<RuntimeHealth> {
  return {
    ok: true,
    runtime: 'dexter',
    mode: 'webui',
    model: getSetting('modelId', 'gpt-5.4'),
    gatewayCompatible: true,
  };
}
