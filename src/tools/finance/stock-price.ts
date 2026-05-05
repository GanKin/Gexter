import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchHistoricalStockPrices, fetchStockPriceSnapshot, fetchStockTickers } from './free-data.js';
import { formatToolResult } from '../types.js';

export const STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots for equities, including open, high, low, close prices, volume, and market cap. Powered by free market data providers.
`.trim();

const StockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch current price for. For example, 'AAPL' for Apple."),
});

export const getStockPrice = new DynamicStructuredTool({
  name: 'get_stock_price',
  description:
    'Fetches the current stock price snapshot for an equity ticker, including open, high, low, close prices, volume, market cap, and 52-week range when available.',
  schema: StockPriceInputSchema,
  func: async (input) => {
    const { data, sourceUrls } = await fetchStockPriceSnapshot(input.ticker);
    return formatToolResult(data, sourceUrls);
  },
});

const StockPricesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch historical prices for. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['minute', 'day', 'week', 'month', 'year'])
    .default('day')
    .describe("The time interval for price data. Defaults to 'day'."),
  interval_multiplier: z
    .number()
    .default(1)
    .describe('Multiplier for the interval. Defaults to 1.'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Required.'),
});

export const getStockPrices = new DynamicStructuredTool({
  name: 'get_stock_prices',
  description:
    'Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices and volume.',
  schema: StockPricesInputSchema,
  func: async (input) => {
    const { data, sourceUrls } = await fetchHistoricalStockPrices({
      ticker: input.ticker,
      interval: input.interval,
      interval_multiplier: input.interval_multiplier,
      start_date: input.start_date,
      end_date: input.end_date,
    });
    return formatToolResult(data, sourceUrls);
  },
});

export const getStockTickers = new DynamicStructuredTool({
  name: 'get_stock_tickers',
  description: 'Retrieves a list of available stock tickers, and can optionally narrow by ticker prefix or company name.',
  schema: z.object({
    query: z.string().optional().describe('Optional ticker prefix or company name to narrow the results.'),
    market: z.string().optional().describe('Optional market filter, defaults to stocks.'),
    type: z.string().optional().describe('Optional security type filter, e.g. CS or ETF.'),
    exchange: z.string().optional().describe('Optional exchange filter, e.g. XNAS.'),
    active: z.boolean().default(true).optional().describe('Whether to return only active tickers.'),
    limit: z.number().default(100).optional().describe('Maximum number of tickers to return.'),
  }),
  func: async (input) => {
    const { data, sourceUrls } = await fetchStockTickers({
      query: input.query,
      market: input.market,
      type: input.type,
      exchange: input.exchange,
      active: input.active,
      limit: input.limit,
    });
    return formatToolResult(data, sourceUrls);
  },
});
