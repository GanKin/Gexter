import { describe, expect, test } from 'bun:test';
import { FINANCIAL_FORMATTERS, MARKET_DATA_FORMATTERS } from './formatters.js';
import { buildRouterPrompt as buildFinancialRouterPrompt } from './get-financials.js';
import { buildRouterPrompt as buildMarketRouterPrompt } from './get-market-data.js';
import { combineRouterToolResults } from './router-utils.js';

describe('finance router regressions', () => {
  test('financial router prompt keeps the renamed key ratios tool and merge helper preserves _errors', () => {
    const prompt = buildFinancialRouterPrompt();
    expect(prompt).toContain('get_key_ratios');
    expect(prompt).not.toContain('get_financial_metrics_snapshot');

    const { combinedData } = combineRouterToolResults(
      [
        {
          tool: 'get_key_ratios',
          args: { ticker: 'AAPL' },
          data: {
            ticker: 'AAPL',
            company_name: 'Apple Inc.',
            sector: 'Technology',
            market_cap: 3_000_000_000_000,
            pe_ratio: 30.2,
          },
          sourceUrls: ['https://example.com/ratios'],
          error: null,
        },
        {
          tool: 'get_income_statements',
          args: { ticker: 'AAPL', period: 'annual', limit: 1 },
          data: null,
          sourceUrls: [],
          error: 'statement unavailable',
        },
      ],
      FINANCIAL_FORMATTERS,
    );

    const output = JSON.stringify(combinedData);
    expect(output).toContain('Company Facts & Key Metrics');
    expect(output).toContain('Apple Inc.');
    expect(JSON.stringify(combinedData._errors)).toContain('get_income_statements');
  });

  test('market router prompt keeps the renamed ticker tools and merge helper formats price snapshots', () => {
    const prompt = buildMarketRouterPrompt();
    expect(prompt).toContain('get_stock_tickers');
    expect(prompt).toContain('get_crypto_tickers');
    expect(prompt).not.toContain('get_available_stock_tickers');
    expect(prompt).not.toContain('get_available_crypto_tickers');

    const { combinedData } = combineRouterToolResults(
      [
        {
          tool: 'get_stock_price',
          args: { ticker: 'AAPL' },
          data: {
            ticker: 'AAPL',
            price: 123.45,
            open: 120.1,
            high: 125.0,
            low: 119.5,
            market_cap: 3_000_000_000_000,
          },
          sourceUrls: ['https://example.com/quote'],
          error: null,
        },
        {
          tool: 'get_stock_tickers',
          args: { query: 'Apple' },
          data: [{ ticker: 'AAPL', name: 'Apple Inc.', exchange: 'XNAS', type: 'CS' }],
          sourceUrls: ['https://example.com/tickers'],
          error: null,
        },
        {
          tool: 'get_crypto_tickers',
          args: { query: 'Bitcoin' },
          data: [{ symbol: 'BTC-USD', description: 'Bitcoin / USD', exchange: 'BINANCE', type: 'spot' }],
          sourceUrls: ['https://example.com/crypto'],
          error: null,
        },
      ],
      MARKET_DATA_FORMATTERS,
    );

    const output = JSON.stringify(combinedData);
    expect(output).toContain('AAPL: $123.45');
    expect(output).toContain('Mkt Cap');
    expect(output).toContain('Tickers');
    expect(output).toContain('Apple Inc.');
    expect(output).toContain('BTC-USD');
  });
});
