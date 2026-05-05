import { describe, expect, test } from 'bun:test';

import { formatUserFacingError } from './errors';

describe('formatUserFacingError', () => {
  test('gives local provider auth errors a local-specific hint', () => {
    const message = formatUserFacingError('401 unauthorized', 'OpenAI Compatible Local');

    expect(message).toContain('Base URL');
    expect(message).toContain('本地服务');
    expect(message).not.toContain('environment variables');
  });

  test('keeps the generic auth hint for cloud providers', () => {
    const message = formatUserFacingError('401 unauthorized', 'OpenAI');

    expect(message).toContain('environment variables');
    expect(message).not.toContain('Base URL');
  });
});
