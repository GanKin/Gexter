type Rec = Record<string, unknown>;

export interface RouterToolResult {
  tool: string;
  args: Rec;
  data: unknown;
  sourceUrls: string[];
  error: string | null;
}

export function combineRouterToolResults(
  results: RouterToolResult[],
  formatters: Record<string, (data: unknown, args?: Rec) => string>,
): { combinedData: Record<string, unknown>; allUrls: string[] } {
  const successfulResults = results.filter((r) => r.error === null);
  const failedResults = results.filter((r) => r.error !== null);
  const allUrls = [...new Set(results.flatMap((r) => r.sourceUrls).filter((url) => typeof url === 'string' && url.length > 0))];
  const combinedData: Record<string, unknown> = {};

  for (const result of successfulResults) {
    const ticker = result.args.ticker as string | undefined;
    const key = ticker ? `${result.tool}_${ticker}` : result.tool;
    const formatter = formatters[result.tool];
    combinedData[key] = formatter ? formatter(result.data, result.args) : result.data;
  }

  if (failedResults.length > 0) {
    combinedData._errors = failedResults.map((result) => ({
      tool: result.tool,
      args: result.args,
      error: result.error,
    }));
  }

  return { combinedData, allUrls };
}
