import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchHistoricalKeyRatios, fetchKeyRatios } from './free-data.js';
import { formatToolResult } from '../types.js';

const KeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch key ratios for. For example, 'AAPL' for Apple."),
});

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description:
    'Fetches the latest company facts and financial metrics snapshot for a company, including profile fields (sector, industry, exchange, website, employees, listing date) plus valuation ratios (P/E, P/B, P/S, EV/EBITDA, PEG), profitability (margins, ROE, ROA, ROIC), liquidity (current/quick ratios), leverage (debt/equity), per-share metrics (EPS), and growth rates (revenue, earnings, EPS, FCF).',
  schema: KeyRatiosInputSchema,
  func: async (input) => {
    const { data, sourceUrls } = await fetchKeyRatios({ ticker: input.ticker });
    return formatToolResult(data, sourceUrls);
  },
});

const HistoricalKeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch historical key ratios for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .default('ttm')
    .describe(
      "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(4)
    .describe('The number of past financial statements to retrieve.'),
  report_period: z
    .string()
    .optional()
    .describe('Filter for key ratios with an exact report period date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or before this date (YYYY-MM-DD).'
    ),
});

export const getHistoricalKeyRatios = new DynamicStructuredTool({
  name: 'get_historical_key_ratios',
  description: `Retrieves historical key ratios for a company, such as P/E ratio, revenue per share, and enterprise value, over a specified period. Useful for trend analysis and historical performance evaluation.`,
  schema: HistoricalKeyRatiosInputSchema,
  func: async (input) => {
    const { data, sourceUrls } = await fetchHistoricalKeyRatios({
      ticker: input.ticker,
      period: input.period,
      limit: input.limit,
      report_period: input.report_period,
      report_period_gt: input.report_period_gt,
      report_period_gte: input.report_period_gte,
      report_period_lt: input.report_period_lt,
      report_period_lte: input.report_period_lte,
    });
    return formatToolResult(data, sourceUrls);
  },
});
