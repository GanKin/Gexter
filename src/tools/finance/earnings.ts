import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchEarnings } from './free-data.js';
import { formatToolResult } from '../types.js';

const EarningsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch the latest earnings for. For example, 'AAPL' for Apple."),
});

export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description:
    'Fetches the most recent earnings snapshot for a company, including key income statement, balance sheet, and cash flow figures from the 8-K earnings release, plus analyst estimate comparisons (revenue and EPS surprise) when available.',
  schema: EarningsInputSchema,
  func: async (input) => {
    const { data, sourceUrls } = await fetchEarnings({
      ticker: input.ticker.trim().toUpperCase(),
    });
    return formatToolResult(data, sourceUrls);
  },
});
