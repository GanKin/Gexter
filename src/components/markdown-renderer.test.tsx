import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MarkdownRenderer } from './markdown-renderer';

describe('MarkdownRenderer', () => {
  test('renders markdown tables as semantic HTML tables', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content={`
| 财季 | 收入 | EPS |
|---|---:|---|
| Q4 2025 | $10.27B | $1.53 |
| Q3 2025 | $9.25B | $1.20 |
        `}
      />,
    );

    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Q4 2025');
    expect(html).toContain('$10.27B');
  });
});
