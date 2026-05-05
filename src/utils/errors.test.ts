import { describe, expect, test } from 'bun:test';

import { formatUserFacingError } from './errors';

describe('formatUserFacingError', () => {
  test('gives OpenAI-compatible auth errors a Base URL hint', () => {
    const message = formatUserFacingError('401 unauthorized', 'OpenAI Compatible API');

    expect(message).toContain('Base URL');
    expect(message).toContain('OpenAI 兼容服务');
    expect(message).not.toContain('environment variables');
  });

  test('keeps the generic auth hint for cloud providers', () => {
    const message = formatUserFacingError('401 unauthorized', 'OpenAI');

    expect(message).toContain('environment variables');
    expect(message).not.toContain('Base URL');
  });
});
