import { afterEach, describe, expect, test } from 'bun:test';
import { finnhubClient, fmpClient, polygonClient, secClient } from './clients.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
  FMP_API_KEY: process.env.FMP_API_KEY,
  POLYGON_API_KEY: process.env.POLYGON_API_KEY,
};

function installFetchMock(body: unknown, calls: Array<{ input: string; init?: RequestInit }>) {
  const globalScope = globalThis as typeof globalThis & { fetch: typeof fetch };
  globalScope.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

afterEach(() => {
  const globalScope = globalThis as typeof globalThis & { fetch: typeof fetch };
  globalScope.fetch = originalFetch;
  process.env.FINNHUB_API_KEY = originalEnv.FINNHUB_API_KEY;
  process.env.FMP_API_KEY = originalEnv.FMP_API_KEY;
  process.env.POLYGON_API_KEY = originalEnv.POLYGON_API_KEY;
});

describe('finance provider clients', () => {
  test('attach auth correctly and sanitize returned urls', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    installFetchMock({ ok: true }, calls);

    process.env.FINNHUB_API_KEY = 'finnhub-test-key';
    process.env.FMP_API_KEY = 'fmp-test-key';
    process.env.POLYGON_API_KEY = 'polygon-test-key';

    const finnhub = await finnhubClient.get('/quote', { symbol: 'AAPL' });
    expect(calls[0]?.input).toContain('token=finnhub-test-key');
    expect(calls[0]?.input).toContain('symbol=AAPL');
    expect(finnhub.url).not.toContain('token=');

    const fmp = await fmpClient.get('/profile', { symbol: 'AAPL' });
    const fmpHeaders = new Headers(calls[1]?.init?.headers);
    expect(fmpHeaders.get('apikey')).toBe('fmp-test-key');
    expect(fmp.url).toContain('https://financialmodelingprep.com/stable/profile?symbol=AAPL');

    const polygon = await polygonClient.get('/v3/reference/tickers', { search: 'Apple' });
    expect(calls[2]?.input).toContain('apiKey=polygon-test-key');
    expect(polygon.url).not.toContain('apiKey=');

    const sec = await secClient.get('/files/company_tickers.json', {});
    const secHeaders = new Headers(calls[3]?.init?.headers);
    expect(secHeaders.get('User-Agent')).toContain('Dexter/');
    expect(secHeaders.get('Accept')).toContain('application/json');
    expect(sec.url).toBe('https://www.sec.gov/files/company_tickers.json');
  });
});
