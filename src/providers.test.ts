import { describe, expect, test } from 'bun:test';

import { resolveProvider } from './providers';

describe('providers', () => {
  test('labels local-prefix models as OpenAI-compatible API', () => {
    const provider = resolveProvider('local:glm-4.5');

    expect(provider.id).toBe('local');
    expect(provider.displayName).toBe('OpenAI Compatible API');
  });

  test('keeps default OpenAI label for unprefixed models', () => {
    const provider = resolveProvider('gpt-5.4');

    expect(provider.id).toBe('openai');
    expect(provider.displayName).toBe('OpenAI');
  });
});
