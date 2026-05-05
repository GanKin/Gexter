import { describe, expect, test } from 'bun:test';

import { parseMarkdownTable, transformMarkdownTables } from './markdown-table.js';

describe('markdown table utils', () => {
  test('parses a standard markdown table with alignment hints', () => {
    const parsed = parseMarkdownTable(`
| 财季 | 收入 | EPS |
|:---|---:|:---:|
| Q4 2025 | $10.27B | $1.53 |
| Q3 2025 | $9.25B | $1.20 |
    `);

    expect(parsed).not.toBeNull();
    expect(parsed?.headers).toEqual(['财季', '收入', 'EPS']);
    expect(parsed?.alignments).toEqual(['left', 'right', 'center']);
    expect(parsed?.rows).toEqual([
      ['Q4 2025', '$10.27B', '$1.53'],
      ['Q3 2025', '$9.25B', '$1.20'],
    ]);
  });

  test('preserves escaped pipes inside cells', () => {
    const parsed = parseMarkdownTable(`
| 指标 | 说明 |
|---|---|
| 风险 | 需要展示 A \\| B 两个选项 |
    `);

    expect(parsed?.rows[0]).toEqual(['风险', '需要展示 A | B 两个选项']);
  });

  test('transforms table blocks into box drawing tables', () => {
    const output = transformMarkdownTables(`
前言

| 财季 | 收入 |
|---|---|
| Q4 2025 | $10.27B |

结论
    `);

    expect(output).toContain('┌');
    expect(output).toContain('│ 财季');
    expect(output).toContain('Q4 2025');
    expect(output).toContain('结论');
  });
});
