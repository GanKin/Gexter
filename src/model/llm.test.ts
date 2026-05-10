import { describe, expect, test } from 'bun:test';

import { getChatModel } from './llm';

describe('getChatModel OpenAI-compatible provider', () => {
  test('does not inject a fake auth header when no compatible api key is configured', () => {
    const model = getChatModel('local:gemma-4-26b-it', false);
    const anyModel = model as unknown as {
      apiKey?: string;
      clientConfig?: {
        baseURL?: string;
        defaultHeaders?: Record<string, unknown>;
      };
    };

    expect(anyModel.apiKey).toBe('');
    expect(anyModel.clientConfig?.baseURL).toBeUndefined();
    expect(anyModel.clientConfig?.defaultHeaders?.Authorization).toBeNull();
  });

  test('preserves explicit compatible auth and base url overrides', () => {
    const model = getChatModel('local:gemma-4-26b-it', false, 'local-secret', 'http://127.0.0.1:1234/v1');
    const anyModel = model as unknown as {
      apiKey?: string;
      clientConfig?: {
        baseURL?: string;
        defaultHeaders?: Record<string, unknown>;
      };
    };

    expect(anyModel.apiKey).toBe('local-secret');
    expect(anyModel.clientConfig?.baseURL).toBe('http://127.0.0.1:1234/v1');
    expect(anyModel.clientConfig?.defaultHeaders?.Authorization).toBeUndefined();
  });

  test('enables SiliconFlow thinking support for glm models', () => {
    const model = getChatModel('glm-5.1', true, 'siliconflow-key', 'https://api.siliconflow.cn/v1');
    const anyModel = model as unknown as {
      completions?: {
        constructor?: {
          name?: string;
        };
      };
      clientConfig?: {
        baseURL?: string;
      };
    };

    expect(anyModel.clientConfig?.baseURL).toBe('https://api.siliconflow.cn/v1');
    expect(anyModel.completions?.constructor?.name).toBe('SiliconFlowChatOpenAICompletions');
  });
});
