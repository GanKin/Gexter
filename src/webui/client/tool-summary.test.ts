import { describe, expect, test } from 'bun:test';

import { summarizeToolTarget } from './tool-summary';

describe('tool summary extraction', () => {
  test('summarizes query-based tools with ticker and action cues', () => {
    expect(summarizeToolTarget('get_financials', { query: '分析CRWV的财报' })).toBe('CRWV 财报');
    expect(summarizeToolTarget('get_market_data', { query: 'compare AAPL vs MSFT revenue' })).toBe('AAPL / MSFT');
    expect(summarizeToolTarget('read_filings', { query: 'read CRWV 10-Q risk factors' })).toBe('CRWV 10-Q');
  });

  test('summarizes url and path based tools', () => {
    expect(summarizeToolTarget('web_fetch', { url: 'https://sec.gov/Archives/edgar/data/1/index.html' })).toBe('sec.gov/Archives');
    expect(summarizeToolTarget('web_fetch', { path: '/Users/me/Documents/report.pdf' })).toBe('Documents/report.pdf');
  });

  test('falls back to a readable placeholder when no target can be inferred', () => {
    expect(summarizeToolTarget('get_financials', {})).toBe('…');
  });
});
