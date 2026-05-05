import { finnhubClient, fmpClient, polygonClient, secClient, type QueryParams } from './clients.js';
import { TTL_15M, TTL_1H, TTL_6H, TTL_24H } from './utils.js';

type Rec = Record<string, unknown>;

export interface ToolDataResult<T> {
  data: T;
  sourceUrls: string[];
}

function asRecord(value: unknown): Rec {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%]/g, '').trim();
    if (cleaned.length === 0) {
      return undefined;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizePercent(value: unknown): number | undefined {
  const num = asNumber(value);
  if (num === undefined) {
    return undefined;
  }
  return Math.abs(num) > 1 ? num / 100 : num;
}

function pickValue(record: Rec, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

function pickString(record: Rec, keys: string[]): string | undefined {
  return asString(pickValue(record, keys));
}

function pickNumber(record: Rec, keys: string[]): number | undefined {
  return asNumber(pickValue(record, keys));
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.filter((url) => typeof url === 'string' && url.length > 0))];
}

function toDayString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().slice(0, 10);
  }
  const num = asNumber(value);
  if (num === undefined) {
    return undefined;
  }
  const date = new Date(num > 1e12 ? num : num * 1000);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

function epochToIso(value: unknown): string | undefined {
  const num = asNumber(value);
  if (num === undefined) {
    return undefined;
  }
  const date = new Date(num * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function nowUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const safe = Number.isFinite(limit ?? NaN) ? Math.trunc(limit as number) : fallback;
  return Math.min(Math.max(safe, 1), max);
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function normalizeCryptoSymbol(ticker: string): string {
  const normalized = normalizeTicker(ticker);
  if (normalized.includes(':')) {
    return normalized;
  }

  const [base, quote = 'USD'] = normalized.split('-');
  const quoteSymbol = quote === 'USD' ? 'USDT' : quote;
  return `BINANCE:${base}${quoteSymbol}`;
}

function normalizeStatementPeriod(period: string | undefined): 'annual' | 'quarter' | 'ttm' {
  if (period === 'quarterly') {
    return 'quarter';
  }
  if (period === 'ttm') {
    return 'ttm';
  }
  return 'annual';
}

function buildStatementQuery(
  ticker: string,
  period: 'annual' | 'quarter' | 'ttm',
  limit: number,
): Record<string, string | number> {
  return {
    symbol: ticker,
    period: period === 'quarter' ? 'quarter' : period,
    limit,
    page: 0,
  };
}

function normalizeIncomeRows(rows: Rec[]): Rec[] {
  return rows.map((row) => ({
    report_period: toDayString(row.date ?? row.report_period ?? row.fiscalDateEnding ?? row.period),
    fiscal_period: asString(row.period ?? row.fiscalPeriod),
    currency: asString(row.reportedCurrency ?? row.currency),
    revenue: asNumber(row.revenue),
    gross_profit: asNumber(row.grossProfit ?? row.gross_profit),
    operating_income: asNumber(row.operatingIncome ?? row.operating_income),
    net_income: asNumber(row.netIncome ?? row.net_income),
    earnings_per_share: asNumber(row.eps ?? row.epsdiluted ?? row.epsDiluted ?? row.earningsPerShare),
    basic_earnings_per_share: asNumber(row.eps ?? row.basicEps ?? row.basic_earnings_per_share),
    free_cash_flow: asNumber(row.freeCashFlow ?? row.free_cash_flow),
    raw: row,
  }));
}

function normalizeBalanceRows(rows: Rec[]): Rec[] {
  return rows.map((row) => ({
    report_period: toDayString(row.date ?? row.report_period ?? row.fiscalDateEnding ?? row.period),
    fiscal_period: asString(row.period ?? row.fiscalPeriod),
    currency: asString(row.reportedCurrency ?? row.currency),
    total_assets: asNumber(row.totalAssets ?? row.total_assets),
    total_liabilities: asNumber(row.totalLiabilities ?? row.total_liabilities),
    shareholders_equity: asNumber(row.totalStockholdersEquity ?? row.totalEquity ?? row.shareholdersEquity ?? row.shareholders_equity),
    cash_and_equivalents: asNumber(row.cashAndCashEquivalents ?? row.cashAndEquivalents ?? row.cashAndShortTermInvestments ?? row.cash_and_equivalents),
    total_debt: asNumber(row.totalDebt ?? row.longTermDebt ?? row.shortTermDebt),
    raw: row,
  }));
}

function normalizeCashFlowRows(rows: Rec[]): Rec[] {
  return rows.map((row) => {
    const operatingCashFlow = asNumber(row.operatingCashFlow ?? row.netCashProvidedByOperatingActivities ?? row.net_cash_flow_from_operations);
    const capitalExpenditure = asNumber(row.capitalExpenditure ?? row.capitalExpenditures ?? row.capital_expenditure);

    return {
      report_period: toDayString(row.date ?? row.report_period ?? row.fiscalDateEnding ?? row.period),
      fiscal_period: asString(row.period ?? row.fiscalPeriod),
      currency: asString(row.reportedCurrency ?? row.currency),
      operating_cash_flow: operatingCashFlow,
      net_cash_flow_from_operations: operatingCashFlow,
      capital_expenditure: capitalExpenditure,
      free_cash_flow: asNumber(row.freeCashFlow ?? (operatingCashFlow !== undefined && capitalExpenditure !== undefined ? operatingCashFlow - Math.abs(capitalExpenditure) : undefined)),
      raw: row,
    };
  });
}

function normalizeRatioRows(rows: Rec[]): Rec[] {
  return rows.map((row) => ({
    report_period: toDayString(row.date ?? row.report_period ?? row.fiscalDateEnding ?? row.period),
    period: asString(row.period),
    pe_ratio: asNumber(row.peRatioTTM ?? row.priceToEarningsRatioTTM ?? row.peRatio ?? row.priceEarningsRatioTTM ?? row.priceEarningsRatio ?? row.pe_ratio),
    eps: asNumber(row.epsTTM ?? row.netIncomePerShareTTM ?? row.earningsPerShareTTM ?? row.eps ?? row.epsDiluted ?? row.earningsPerShare),
    revenue_growth_rate: normalizePercent(row.revenueGrowthTTM ?? row.revenueGrowth ?? row.revenueGrowthRate ?? row.revenue_growth_rate),
    earnings_growth_rate: normalizePercent(row.growthNetIncomeTTM ?? row.growthNetIncome ?? row.earningsGrowth ?? row.earnings_growth_rate),
    operating_margin: normalizePercent(row.operatingProfitMarginTTM ?? row.operatingProfitMargin ?? row.operatingMarginTTM ?? row.operatingMargin ?? row.operating_margin),
    gross_margin: normalizePercent(row.grossProfitMarginTTM ?? row.grossProfitMargin ?? row.grossMarginTTM ?? row.gross_margin),
    net_margin: normalizePercent(row.netProfitMarginTTM ?? row.bottomLineProfitMarginTTM ?? row.netProfitMargin ?? row.net_margin),
    roe: normalizePercent(row.returnOnEquityTTM ?? row.returnOnEquityAnnual ?? row.returnOnEquity ?? row.roe),
    roa: normalizePercent(row.returnOnAssetsTTM ?? row.returnOnAssetsAnnual ?? row.returnOnAssets ?? row.roa),
    roic: normalizePercent(row.returnOnInvestedCapitalTTM ?? row.returnOnInvestedCapitalAnnual ?? row.returnOnInvestedCapital ?? row.roic),
    current_ratio: asNumber(row.currentRatioTTM ?? row.currentRatioAnnual ?? row.currentRatio ?? row.current_ratio),
    quick_ratio: asNumber(row.quickRatioTTM ?? row.quickRatioAnnual ?? row.quickRatio ?? row.quick_ratio),
    debt_to_equity: asNumber(row.debtToEquityRatioTTM ?? row.debtToEquityTTM ?? row.debtToEquity ?? row.debt_to_equity),
    dividend_yield: normalizePercent(row.dividendYieldTTM ?? row.dividendYield ?? row.dividend_yield),
    free_cash_flow_yield: normalizePercent(row.freeCashFlowYieldTTM ?? row.free_cash_flow_yield),
    raw: row,
  }));
}

function normalizeProfileRow(profile: Rec, ticker: string): Rec {
  return {
    ticker,
    company_name: pickString(profile, ['companyName', 'name']) ?? ticker,
    sector: pickString(profile, ['sector']),
    industry: pickString(profile, ['industry', 'finnhubIndustry']),
    market_cap: pickNumber(profile, ['marketCap', 'mktCap', 'marketCapitalization']),
    exchange: pickString(profile, ['exchange', 'exchangeShortName']),
    website: pickString(profile, ['website', 'weburl']),
    employees: pickNumber(profile, ['fullTimeEmployees', 'shareOutstanding', 'employees']),
    listing_date: toDayString(profile.ipoDate ?? profile.listingDate ?? profile.ipo_date),
    country: pickString(profile, ['country']),
    currency: pickString(profile, ['currency']),
    price: pickNumber(profile, ['price']),
    beta: pickNumber(profile, ['beta']),
    raw: profile,
  };
}

function normalizeMetricSnapshot(metric: Rec, ticker: string): Rec {
  const snapshot = asRecord(metric.metric ?? metric);
  return {
    ticker,
    market_cap: pickNumber(snapshot, ['marketCapitalization', 'market_cap']),
    enterprise_value: pickNumber(snapshot, ['enterpriseValue', 'enterprise_value']),
    pe_ratio: pickNumber(snapshot, ['peNormalizedAnnual', 'peNormalizedTTM', 'peRatio', 'priceEarningsRatio']),
    pb_ratio: pickNumber(snapshot, ['pbAnnual', 'priceToBookRatioAnnual', 'priceToBookRatio']),
    ps_ratio: pickNumber(snapshot, ['psAnnual', 'priceToSalesRatioAnnual', 'priceToSalesRatio']),
    peg_ratio: pickNumber(snapshot, ['pegRatio', 'pegAnnual']),
    gross_margin: normalizePercent(snapshot.grossMarginTTM ?? snapshot.grossMarginAnnual ?? snapshot.grossMargin),
    operating_margin: normalizePercent(snapshot.operatingMarginTTM ?? snapshot.operatingMarginAnnual ?? snapshot.operatingMargin),
    net_margin: normalizePercent(snapshot.netProfitMarginTTM ?? snapshot.netProfitMarginAnnual ?? snapshot.netProfitMargin),
    roe: normalizePercent(snapshot.returnOnEquityTTM ?? snapshot.returnOnEquityAnnual ?? snapshot.returnOnEquity),
    roa: normalizePercent(snapshot.returnOnAssetsTTM ?? snapshot.returnOnAssetsAnnual ?? snapshot.returnOnAssets),
    roic: normalizePercent(snapshot.returnOnInvestedCapitalTTM ?? snapshot.returnOnInvestedCapitalAnnual ?? snapshot.returnOnInvestedCapital),
    current_ratio: pickNumber(snapshot, ['currentRatioTTM', 'currentRatioAnnual', 'currentRatio']),
    quick_ratio: pickNumber(snapshot, ['quickRatioTTM', 'quickRatioAnnual', 'quickRatio']),
    debt_to_equity: pickNumber(snapshot, ['debtToEquityAnnual', 'debtToEquityTTM', 'debtToEquity']),
    dividend_yield: normalizePercent(snapshot.dividendYieldIndicatedAnnual ?? snapshot.dividendYieldTTM ?? snapshot.dividendYield),
    revenue_growth_rate: normalizePercent(snapshot.revenueGrowthAnnual ?? snapshot.revenueGrowthTTM ?? snapshot.revenueGrowth),
    earnings_growth_rate: normalizePercent(snapshot.earningsGrowthAnnual ?? snapshot.earningsGrowthTTM ?? snapshot.earningsGrowth),
    eps: pickNumber(snapshot, ['epsTTM', 'epsAnnual', 'earningsPerShare']),
    free_cash_flow_yield: normalizePercent(snapshot.freeCashFlowYieldTTM ?? snapshot.freeCashFlowYield),
    week_52_high: pickNumber(snapshot, ['52WeekHigh', '52WeekHighAnnual', '52WeekHighTTM']),
    week_52_low: pickNumber(snapshot, ['52WeekLow', '52WeekLowAnnual', '52WeekLowTTM']),
    raw: snapshot,
  };
}

function mergeSources(...urls: string[][]): string[] {
  return dedupeUrls(urls.flat());
}

function normalizeTickerRow(row: Rec): Rec {
  return {
    ticker: pickString(row, ['ticker', 'symbol', 'displaySymbol']) ?? '',
    name: pickString(row, ['name', 'description']) ?? '',
    exchange: pickString(row, ['exchange', 'exchangeShortName', 'primary_exchange']),
    market: pickString(row, ['market', 'assetClass']) ?? 'stocks',
    type: pickString(row, ['type', 'securityType', 'assetType']),
    active: row.active === undefined ? undefined : Boolean(row.active),
    currency: pickString(row, ['currency']),
    market_cap: pickNumber(row, ['marketCap', 'market_cap']),
    raw: row,
  };
}

function normalizeCryptoTickerRow(row: Rec, exchange?: string): Rec {
  return {
    symbol: pickString(row, ['symbol', 'displaySymbol']) ?? '',
    description: pickString(row, ['description', 'name']) ?? '',
    exchange: exchange ?? pickString(row, ['exchange', 'mic']),
    base_currency: pickString(row, ['baseCurrency', 'base_currency']),
    quote_currency: pickString(row, ['quoteCurrency', 'quote_currency']),
    type: pickString(row, ['type']),
    raw: row,
  };
}

function normalizeNewsRow(row: Rec, ticker?: string): Rec {
  return {
    ticker,
    title: pickString(row, ['headline', 'title']) ?? '',
    source: pickString(row, ['source', 'provider']),
    date: epochToIso(row.datetime ?? row.time ?? row.publishedAt ?? row.date),
    summary: pickString(row, ['summary', 'description']),
    url: pickString(row, ['url', 'link']),
    related: pickString(row, ['related', 'symbols']),
    image: pickString(row, ['image']),
    raw: row,
  };
}

function normalizeInsiderRow(row: Rec, ticker?: string): Rec {
  return {
    ticker: ticker ?? pickString(row, ['symbol', 'ticker']),
    full_name: pickString(row, ['reportingName', 'ownerName', 'owner', 'name', 'fullName']),
    officer_title: pickString(row, ['title', 'officerTitle', 'role', 'companyTitle']),
    transaction_type: pickString(row, ['transactionType', 'type', 'transaction_type']),
    shares: asNumber(row.securitiesTransacted ?? row.shares ?? row.securities),
    price_per_share: asNumber(row.price ?? row.pricePerShare ?? row.transactionPrice),
    filing_date: toDayString(row.filingDate ?? row.filing_date ?? row.dateFiled ?? row.date),
    transaction_date: toDayString(row.transactionDate ?? row.transaction_date ?? row.transaction_date_time),
    accession_number: pickString(row, ['accessionNumber', 'accession_number']),
    source_url: pickString(row, ['url', 'filingUrl', 'sourceUrl']),
    raw: row,
  };
}

function normalizeAnalystEstimateRow(row: Rec): Rec {
  return {
    report_period: toDayString(row.period ?? row.fiscalPeriod ?? row.date ?? row.report_date),
    estimated_revenue_avg: asNumber(row.revenueEstimateAvg ?? row.estimatedRevenueAvg ?? row.revenueAvg ?? row.revenueEstimate),
    estimated_eps_avg: asNumber(row.epsEstimateAvg ?? row.estimatedEpsAvg ?? row.epsAvg ?? row.epsEstimate),
    number_of_analysts: asNumber(row.numberAnalysts ?? row.numberOfAnalysts ?? row.analystCount),
    high: asNumber(row.revenueHigh ?? row.epsHigh ?? row.high),
    low: asNumber(row.revenueLow ?? row.epsLow ?? row.low),
    currency: pickString(row, ['currency']),
    raw: row,
  };
}

function normalizeEarningsRow(row: Rec, ticker: string): Rec {
  return {
    ticker,
    report_period: toDayString(row.period ?? row.date ?? row.reportPeriod),
    fiscal_period: row.quarter !== undefined && row.year !== undefined ? `Q${row.quarter} ${row.year}` : asString(row.period ?? row.quarter),
    actual_eps: asNumber(row.actual ?? row.actualEPS ?? row.epsActual),
    estimated_eps: asNumber(row.estimate ?? row.estimated ?? row.epsEstimate),
    eps_surprise: normalizePercent(row.surprisePercent ?? row.epsSurprisePercent ?? row.eps_surprise),
    actual_revenue: asNumber(row.actualRevenue ?? row.revenueActual),
    estimated_revenue: asNumber(row.estimateRevenue ?? row.revenueEstimate),
    revenue_surprise: normalizePercent(row.revenueSurprisePercent ?? row.revenue_surprise),
    source_type: pickString(row, ['source', 'sourceType']),
    filing_date: toDayString(row.filingDate ?? row.filing_date),
    raw: row,
  };
}

function normalizeStockCandleRow(row: Rec): Rec {
  return {
    date: epochToIso(row.t ?? row.time ?? row.date),
    open: asNumber(row.o ?? row.open),
    high: asNumber(row.h ?? row.high),
    low: asNumber(row.l ?? row.low),
    close: asNumber(row.c ?? row.close),
    volume: asNumber(row.v ?? row.volume),
    raw: row,
  };
}

function normalizeStockAggRow(row: Rec): Rec {
  return {
    date: epochToIso(row.t ?? row.date),
    open: asNumber(row.o ?? row.open),
    high: asNumber(row.h ?? row.high),
    low: asNumber(row.l ?? row.low),
    close: asNumber(row.c ?? row.close),
    volume: asNumber(row.v ?? row.volume),
    transactions: asNumber(row.n ?? row.transactions),
    vwap: asNumber(row.vw ?? row.vwap),
    raw: row,
  };
}

function normalizeCryptoAggRow(row: Rec): Rec {
  return {
    date: epochToIso(row.t ?? row.time ?? row.date),
    open: asNumber(row.o ?? row.open),
    high: asNumber(row.h ?? row.high),
    low: asNumber(row.l ?? row.low),
    close: asNumber(row.c ?? row.close),
    volume: asNumber(row.v ?? row.volume),
    raw: row,
  };
}

function groupCryptoRows(rows: Rec[], interval: 'minute' | 'day' | 'week' | 'month' | 'year'): Rec[] {
  if (interval === 'minute' || interval === 'day') {
    return rows;
  }

  const groups = new Map<string, Rec[]>();

  for (const row of rows) {
    const date = new Date(String(row.date ?? nowUtcDay()));
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    let key: string;
    if (interval === 'week') {
      const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      key = `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    } else if (interval === 'month') {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      key = `${date.getUTCFullYear()}`;
    }

    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([key, bucket]) => {
    const first = bucket[0] ?? {};
    const last = bucket[bucket.length - 1] ?? {};
    const high = Math.max(...bucket.map((row) => Number(row.high ?? -Infinity)));
    const low = Math.min(...bucket.map((row) => Number(row.low ?? Infinity)));
    const volume = bucket.reduce((sum, row) => sum + Number(row.volume ?? 0), 0);

    return {
      date: key,
      open: first.open,
      high: Number.isFinite(high) ? high : undefined,
      low: Number.isFinite(low) ? low : undefined,
      close: last.close,
      volume,
    };
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function getFmpArray<T = Rec>(path: string, params: QueryParams, cacheable = true, ttlMs = TTL_24H): Promise<T[]> {
  const { data, url } = await fmpClient.get(path, params, { cacheable, ttlMs });
  const rows = Array.isArray(data) ? data : asArray<T>(asRecord(data).data ?? asRecord(data).results ?? asRecord(data).financials);
  return rows.length > 0 ? rows : (asArray<T>(data) as T[]);
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export async function fetchStockPriceSnapshot(ticker: string): Promise<ToolDataResult<Rec>> {
  const symbol = normalizeTicker(ticker);
  const [quote, quoteShort, profile, metric] = await Promise.all([
    finnhubClient.get('/quote', { symbol }, { cacheable: true, ttlMs: TTL_15M }),
    fmpClient.get('/quote-short', { symbol }, { cacheable: true, ttlMs: TTL_15M }),
    fmpClient.get('/profile', { symbol }, { cacheable: true, ttlMs: TTL_24H }),
    finnhubClient.get('/stock/metric', { symbol, metric: 'all' }, { cacheable: true, ttlMs: TTL_1H }),
  ]);

  const q = asRecord(quote.data);
  const shortRow = asRecord(asArray(quoteShort.data)[0] ?? quoteShort.data);
  const profileRow = asRecord(asArray(profile.data)[0] ?? profile.data);
  const metricRow = asRecord(metric.data);

  const data = {
    ticker: symbol,
    name: pickString(profileRow, ['companyName', 'name']) ?? symbol,
    exchange: pickString(profileRow, ['exchange', 'exchangeShortName']),
    industry: pickString(profileRow, ['industry', 'finnhubIndustry']),
    sector: pickString(profileRow, ['sector']),
    currency: pickString(profileRow, ['currency']),
    price: asNumber(q.c ?? shortRow.price ?? profileRow.price),
    open: asNumber(q.o ?? shortRow.open),
    high: asNumber(q.h ?? shortRow.dayHigh ?? shortRow.high),
    low: asNumber(q.l ?? shortRow.dayLow ?? shortRow.low),
    previous_close: asNumber(q.pc ?? shortRow.previousClose),
    change: asNumber(q.d ?? shortRow.change),
    percent_change: normalizePercent(q.dp ?? shortRow.changesPercentage),
    volume: asNumber(shortRow.volume ?? profileRow.volume ?? profileRow.volAvg),
    market_cap: asNumber(metricRow.metric && typeof metricRow.metric === 'object'
      ? pickValue(asRecord(metricRow.metric), ['marketCapitalization'])
      : pickValue(metricRow, ['marketCapitalization', 'market_cap'])
    ) ?? asNumber(profileRow.marketCap ?? profileRow.mktCap),
    week_52_high: asNumber(metricRow.metric && typeof metricRow.metric === 'object'
      ? pickValue(asRecord(metricRow.metric), ['52WeekHigh'])
      : pickValue(metricRow, ['52WeekHigh'])
    ),
    week_52_low: asNumber(metricRow.metric && typeof metricRow.metric === 'object'
      ? pickValue(asRecord(metricRow.metric), ['52WeekLow'])
      : pickValue(metricRow, ['52WeekLow'])
    ),
    share_outstanding: asNumber(profileRow.shareOutstanding ?? metricRow.shareOutstanding),
    timestamp: epochToIso(q.t),
    raw: {
      quote: q,
      quote_short: shortRow,
      profile: profileRow,
      metric: metricRow.metric ?? metricRow,
    },
  };

  return {
    data,
    sourceUrls: mergeSources([quote.url], [quoteShort.url], [profile.url], [metric.url]),
  };
}

export interface StockPriceHistoryInput {
  ticker: string;
  interval?: 'minute' | 'day' | 'week' | 'month' | 'year';
  interval_multiplier?: number;
  start_date: string;
  end_date: string;
}

export async function fetchHistoricalStockPrices(input: StockPriceHistoryInput): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeTicker(input.ticker);
  const interval = input.interval ?? 'day';
  const multiplier = clampLimit(input.interval_multiplier, 1, 60);
  const timespan = interval === 'minute' ? 'minute' : interval;
  const { data, url } = await polygonClient.get(
    `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${input.start_date}/${input.end_date}`,
    { adjusted: true, sort: 'asc', limit: 50_000 },
    { cacheable: new Date(`${input.end_date}T00:00:00Z`) < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), ttlMs: TTL_24H },
  );

  const payload = asRecord(data);
  const rows = asArray<Rec>(payload.results ?? payload.data ?? payload.aggregates).map(normalizeStockAggRow);

  return {
    data: rows,
    sourceUrls: [url],
  };
}

export interface StockTickerLookupInput {
  query?: string;
  market?: string;
  type?: string;
  exchange?: string;
  active?: boolean;
  limit?: number;
}

export async function fetchStockTickers(input: StockTickerLookupInput): Promise<ToolDataResult<Rec[]>> {
  const query = input.query?.trim();
  const limit = clampLimit(input.limit, 100, 1_000);

  if (query) {
    const isTickerLike = /^[A-Z0-9.-]{1,12}$/i.test(query) && !query.includes(' ');

    if (isTickerLike) {
      const { data, url } = await polygonClient.get(
        '/v3/reference/tickers',
        {
          ticker: query.toUpperCase(),
          active: input.active ?? true,
          market: input.market ?? 'stocks',
          type: input.type,
          exchange: input.exchange,
          limit,
        },
        { cacheable: true, ttlMs: TTL_24H },
      );
      const payload = asRecord(data);
      const rows = asArray<Rec>(payload.results ?? payload.data).map(normalizeTickerRow).slice(0, limit);
      return { data: rows, sourceUrls: [url] };
    }

    const { data, url } = await polygonClient.get(
      '/v3/reference/tickers',
      {
        search: query,
        active: input.active ?? true,
        market: input.market ?? 'stocks',
        type: input.type,
        exchange: input.exchange,
        limit,
      },
      { cacheable: true, ttlMs: TTL_24H },
    );
    const payload = asRecord(data);
    const rows = asArray<Rec>(payload.results ?? payload.data).map(normalizeTickerRow).slice(0, limit);
    return { data: rows, sourceUrls: [url] };
  }

  const { data, url } = await polygonClient.get(
    '/v3/reference/tickers',
    {
      active: input.active ?? true,
      market: input.market ?? 'stocks',
      type: input.type ?? 'CS',
      exchange: input.exchange,
      limit,
    },
    { cacheable: true, ttlMs: TTL_24H },
  );
  const payload = asRecord(data);
  const rows = asArray<Rec>(payload.results ?? payload.data).map(normalizeTickerRow).slice(0, limit);
  return { data: rows, sourceUrls: [url] };
}

function normalizeCryptoSnapshotRows(rows: Rec[]): Rec[] {
  return rows.map((row) => normalizeCryptoAggRow(row));
}

export interface CryptoPriceSnapshotInput {
  ticker: string;
}

export async function fetchCryptoPriceSnapshot(input: CryptoPriceSnapshotInput): Promise<ToolDataResult<Rec>> {
  const symbol = normalizeCryptoSymbol(input.ticker);
  const now = Math.floor(Date.now() / 1000);
  const from = now - 2 * 24 * 60 * 60;
  const { data, url } = await finnhubClient.get(
    '/crypto/candle',
    { symbol, resolution: 1, from, to: now },
    { cacheable: true, ttlMs: TTL_15M },
  );
  const payload = asRecord(data);
  const closes = asArray<number>(payload.c);
  const opens = asArray<number>(payload.o);
  const highs = asArray<number>(payload.h);
  const lows = asArray<number>(payload.l);
  const volumes = asArray<number>(payload.v);
  const timestamps = asArray<number>(payload.t);
  const rows = closes.length > 0
    ? closes.map((close, index) => ({
        date: epochToIso(timestamps[index]),
        open: opens[index],
        high: highs[index],
        low: lows[index],
        close,
        volume: volumes[index],
      }))
    : [];
  const last = rows[rows.length - 1] ?? {};

  return {
    data: {
      ticker: normalizeTicker(input.ticker),
      symbol,
      price: asNumber(last.close),
      open: asNumber(last.open),
      high: asNumber(last.high),
      low: asNumber(last.low),
      volume: asNumber(last.volume),
      timestamp: asString(last.date),
      raw: payload,
    },
    sourceUrls: [url],
  };
}

export interface CryptoPricesInput {
  ticker: string;
  interval?: 'minute' | 'day' | 'week' | 'month' | 'year';
  interval_multiplier?: number;
  start_date: string;
  end_date: string;
}

function aggregateCandleRows(rows: Rec[], interval: 'minute' | 'day' | 'week' | 'month' | 'year'): Rec[] {
  if (interval === 'minute' || interval === 'day') {
    return rows;
  }

  return groupCryptoRows(rows, interval);
}

export async function fetchHistoricalCryptoPrices(input: CryptoPricesInput): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeCryptoSymbol(input.ticker);
  const interval = input.interval ?? 'day';
  const multiplier = clampLimit(input.interval_multiplier, 1, 60);
  const startEpoch = Math.floor(new Date(`${input.start_date}T00:00:00Z`).getTime() / 1000);
  const endEpoch = Math.floor(new Date(`${input.end_date}T23:59:59Z`).getTime() / 1000);
  const resolution = interval === 'minute' ? multiplier : 'D';

  const { data, url } = await finnhubClient.get(
    '/crypto/candle',
    { symbol, resolution, from: startEpoch, to: endEpoch },
    { cacheable: new Date(`${input.end_date}T00:00:00Z`) < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), ttlMs: TTL_24H },
  );
  const payload = asRecord(data);
  const closes = asArray<number>(payload.c);
  const opens = asArray<number>(payload.o);
  const highs = asArray<number>(payload.h);
  const lows = asArray<number>(payload.l);
  const volumes = asArray<number>(payload.v);
  const timestamps = asArray<number>(payload.t);
  const rawRows = closes.length > 0
    ? closes.map((close, index) => ({
        date: epochToIso(timestamps[index]),
        open: opens[index],
        high: highs[index],
        low: lows[index],
        close,
        volume: volumes[index],
      }))
    : [];

  const rows = aggregateCandleRows(rawRows, interval);
  return {
    data: rows,
    sourceUrls: [url],
  };
}

export async function fetchCryptoPrices(input: CryptoPricesInput): Promise<ToolDataResult<Rec[]>> {
  return fetchHistoricalCryptoPrices(input);
}

export interface CryptoTickerLookupInput {
  exchange?: string;
  query?: string;
  limit?: number;
}

export async function fetchCryptoTickers(input: CryptoTickerLookupInput): Promise<ToolDataResult<Rec[]>> {
  const exchange = input.exchange?.trim() || 'binance';
  const limit = clampLimit(input.limit, 100, 500);
  const { data, url } = await finnhubClient.get(
    '/crypto/symbol',
    { exchange },
    { cacheable: true, ttlMs: TTL_24H },
  );
  const rows = asArray<Rec>(data)
    .map((row) => normalizeCryptoTickerRow(row, exchange))
    .filter((row) => {
      if (!input.query) {
        return true;
      }

      const query = input.query.trim().toUpperCase();
      return (
        String(row.symbol ?? '').toUpperCase().includes(query) ||
        String(row.description ?? '').toUpperCase().includes(query)
      );
    })
    .slice(0, limit);

  return { data: rows, sourceUrls: [url] };
}

export interface CompanyNewsInput {
  ticker?: string;
  limit?: number;
}

export async function fetchCompanyNews(input: CompanyNewsInput): Promise<ToolDataResult<Rec[]>> {
  const limit = clampLimit(input.limit, 5, 10);
  const from = daysAgo(30);
  const to = nowUtcDay();

  if (input.ticker) {
    const symbol = normalizeTicker(input.ticker);
    const { data, url } = await finnhubClient.get(
      '/company-news',
      { symbol, from, to },
      { cacheable: true, ttlMs: TTL_15M },
    );
    const rows = asArray<Rec>(data)
      .map((row) => normalizeNewsRow(row, symbol))
      .slice(0, limit);
    return { data: rows, sourceUrls: [url] };
  }

  const { data, url } = await finnhubClient.get(
    '/news',
    { category: 'general' },
    { cacheable: true, ttlMs: TTL_15M },
  );
  const rows = asArray<Rec>(data)
    .map((row) => normalizeNewsRow(row))
    .slice(0, limit);
  return { data: rows, sourceUrls: [url] };
}

export interface InsiderTradesInput {
  ticker: string;
  limit?: number;
  filing_date?: string;
  filing_date_gte?: string;
  filing_date_lte?: string;
  filing_date_gt?: string;
  filing_date_lt?: string;
  name?: string;
}

export async function fetchInsiderTrades(input: InsiderTradesInput): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeTicker(input.ticker);
  const limit = clampLimit(input.limit, 10, 1_000);
  const pageLimit = Math.min(limit * 5, 1_000);
  const name = typeof input.name === 'string' ? input.name.trim() : undefined;
  const hasName = Boolean(name);

  const { data, url } = await fmpClient.get(
    hasName ? '/insider-trading/reporting-name' : '/insider-trading/search',
    hasName
      ? { name, page: 0, limit: pageLimit }
      : { symbol, page: 0, limit: pageLimit },
    { cacheable: true, ttlMs: TTL_1H },
  );

  const rows = asArray<Rec>(data)
    .map((row) => normalizeInsiderRow(row, symbol))
    .filter((row) => {
      if (String(row.ticker ?? '').toUpperCase() !== symbol) {
        return false;
      }

      if (name) {
        const haystack = `${row.full_name ?? ''} ${row.officer_title ?? ''}`.toUpperCase();
        if (!haystack.includes(name.toUpperCase())) {
          return false;
        }
      }

      const filingDate = row.filing_date;
      if (filingDate && input.filing_date && filingDate !== input.filing_date) {
        return false;
      }
      if (filingDate && input.filing_date_gte && filingDate < input.filing_date_gte) {
        return false;
      }
      if (filingDate && input.filing_date_lte && filingDate > input.filing_date_lte) {
        return false;
      }
      if (filingDate && input.filing_date_gt && filingDate <= input.filing_date_gt) {
        return false;
      }
      if (filingDate && input.filing_date_lt && filingDate >= input.filing_date_lt) {
        return false;
      }

      return true;
    })
    .slice(0, limit);

  return { data: rows, sourceUrls: [url] };
}

// ---------------------------------------------------------------------------
// Financial statements
// ---------------------------------------------------------------------------

async function fetchStatementSeries(
  ticker: string,
  statement: 'income' | 'balance' | 'cash',
  period: 'annual' | 'quarter' | 'ttm',
  limit: number,
): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeTicker(ticker);
  if (period === 'ttm') {
    const path = statement === 'income'
      ? '/income-statement-ttm'
      : statement === 'balance'
        ? '/balance-sheet-statement-ttm'
        : '/cash-flow-statement-ttm';
    const { data, url } = await fmpClient.get(path, { symbol }, { cacheable: true, ttlMs: TTL_24H });
    const rows = asArray<Rec>(data).slice(0, limit);
    return {
      data: statement === 'income'
        ? normalizeIncomeRows(rows)
        : statement === 'balance'
          ? normalizeBalanceRows(rows)
          : normalizeCashFlowRows(rows),
      sourceUrls: [url],
    };
  }

  const path = statement === 'income'
    ? '/income-statement'
    : statement === 'balance'
      ? '/balance-sheet-statement'
      : '/cash-flow-statement';
  const { data, url } = await fmpClient.get(
    path,
    buildStatementQuery(symbol, period, limit),
    { cacheable: true, ttlMs: TTL_24H },
  );
  const rows = asArray<Rec>(data).slice(0, limit);
  return {
    data: statement === 'income'
      ? normalizeIncomeRows(rows)
      : statement === 'balance'
        ? normalizeBalanceRows(rows)
        : normalizeCashFlowRows(rows),
    sourceUrls: [url],
  };
}

export interface FinancialStatementsInput {
  ticker: string;
  period: 'annual' | 'quarterly' | 'ttm';
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}

function filterByReportPeriod(rows: Rec[], input: FinancialStatementsInput): Rec[] {
  return rows.filter((row) => {
    const reportPeriod = asString(row.report_period);
    if (!reportPeriod) {
      return true;
    }

    if (input.report_period_gt && reportPeriod <= input.report_period_gt) {
      return false;
    }
    if (input.report_period_gte && reportPeriod < input.report_period_gte) {
      return false;
    }
    if (input.report_period_lt && reportPeriod >= input.report_period_lt) {
      return false;
    }
    if (input.report_period_lte && reportPeriod > input.report_period_lte) {
      return false;
    }
    return true;
  });
}

export async function fetchIncomeStatements(input: FinancialStatementsInput): Promise<ToolDataResult<Rec[]>> {
  const period = normalizeStatementPeriod(input.period);
  const result = await fetchStatementSeries(input.ticker, 'income', period, input.limit);
  return {
    data: filterByReportPeriod(result.data, input).slice(0, input.limit),
    sourceUrls: result.sourceUrls,
  };
}

export async function fetchBalanceSheets(input: FinancialStatementsInput): Promise<ToolDataResult<Rec[]>> {
  const period = normalizeStatementPeriod(input.period);
  const result = await fetchStatementSeries(input.ticker, 'balance', period, input.limit);
  return {
    data: filterByReportPeriod(result.data, input).slice(0, input.limit),
    sourceUrls: result.sourceUrls,
  };
}

export async function fetchCashFlowStatements(input: FinancialStatementsInput): Promise<ToolDataResult<Rec[]>> {
  const period = normalizeStatementPeriod(input.period);
  const result = await fetchStatementSeries(input.ticker, 'cash', period, input.limit);
  return {
    data: filterByReportPeriod(result.data, input).slice(0, input.limit),
    sourceUrls: result.sourceUrls,
  };
}

export async function fetchAllFinancialStatements(input: FinancialStatementsInput): Promise<ToolDataResult<Rec>> {
  const [income, balance, cash] = await Promise.all([
    fetchIncomeStatements(input),
    fetchBalanceSheets(input),
    fetchCashFlowStatements(input),
  ]);

  return {
    data: {
      income_statements: income.data,
      balance_sheets: balance.data,
      cash_flow_statements: cash.data,
    },
    sourceUrls: mergeSources(income.sourceUrls, balance.sourceUrls, cash.sourceUrls),
  };
}

// ---------------------------------------------------------------------------
// Ratios, profile, estimates, earnings, segmentation
// ---------------------------------------------------------------------------

export interface KeyRatiosInput {
  ticker: string;
}

export async function fetchKeyRatios(input: KeyRatiosInput): Promise<ToolDataResult<Rec>> {
  const symbol = normalizeTicker(input.ticker);
  const [profile, keyMetricsTtm, ratiosTtm, finnhubMetrics] = await Promise.all([
    fmpClient.get('/profile', { symbol }, { cacheable: true, ttlMs: TTL_24H }),
    fmpClient.get('/key-metrics-ttm', { symbol }, { cacheable: true, ttlMs: TTL_6H }),
    fmpClient.get('/ratios-ttm', { symbol }, { cacheable: true, ttlMs: TTL_6H }),
    finnhubClient.get('/stock/metric', { symbol, metric: 'all' }, { cacheable: true, ttlMs: TTL_1H }),
  ]);

  const profileRow = asRecord(asArray<Rec>(profile.data)[0] ?? profile.data);
  const keyMetricsRow = asRecord(asArray<Rec>(keyMetricsTtm.data)[0] ?? keyMetricsTtm.data);
  const ratiosRow = asRecord(asArray<Rec>(ratiosTtm.data)[0] ?? ratiosTtm.data);
  const finnhubMetricRow = asRecord(finnhubMetrics.data);
  const finnhubMetric = asRecord(finnhubMetricRow.metric ?? finnhubMetricRow);

  const data = {
    ticker: symbol,
    company_name: pickString(profileRow, ['companyName', 'name']) ?? symbol,
    sector: pickString(profileRow, ['sector']),
    industry: pickString(profileRow, ['industry', 'finnhubIndustry']),
    market_cap: pickNumber(profileRow, ['marketCap', 'mktCap'])
      ?? pickNumber(keyMetricsRow, ['marketCapTTM', 'marketCap', 'marketCapitalizationTTM', 'marketCapitalization'])
      ?? pickNumber(finnhubMetric, ['marketCapitalization']),
    enterprise_value: pickNumber(keyMetricsRow, ['enterpriseValueTTM', 'enterpriseValue'])
      ?? pickNumber(ratiosRow, ['enterpriseValueTTM', 'enterpriseValue'])
      ?? pickNumber(finnhubMetric, ['enterpriseValue']),
    exchange: pickString(profileRow, ['exchange', 'exchangeShortName']),
    website: pickString(profileRow, ['website', 'weburl']),
    employees: pickNumber(profileRow, ['fullTimeEmployees', 'employees']),
    listing_date: toDayString(profileRow.ipoDate ?? profileRow.listingDate),
    country: pickString(profileRow, ['country']),
    currency: pickString(profileRow, ['currency']),
    price: pickNumber(profileRow, ['price']) ?? pickNumber(keyMetricsRow, ['stockPrice', 'price']) ?? pickNumber(finnhubMetric, ['currentPrice']),
    pe_ratio: pickNumber(keyMetricsRow, ['peRatioTTM', 'priceToEarningsRatioTTM', 'peRatio'])
      ?? pickNumber(ratiosRow, ['priceToEarningsRatioTTM', 'priceToEarningsRatio'])
      ?? pickNumber(finnhubMetric, ['peNormalizedAnnual', 'peNormalizedTTM']),
    pb_ratio: pickNumber(keyMetricsRow, ['pbRatioTTM', 'priceToBookRatioTTM', 'pbRatio'])
      ?? pickNumber(ratiosRow, ['priceToBookRatioTTM', 'priceToBookRatio'])
      ?? pickNumber(finnhubMetric, ['pbAnnual']),
    ps_ratio: pickNumber(keyMetricsRow, ['psRatioTTM', 'priceToSalesRatioTTM', 'psRatio'])
      ?? pickNumber(ratiosRow, ['priceToSalesRatioTTM', 'priceToSalesRatio'])
      ?? pickNumber(finnhubMetric, ['psAnnual']),
    peg_ratio: pickNumber(keyMetricsRow, ['pegRatioTTM', 'pegRatio'])
      ?? pickNumber(ratiosRow, ['priceEarningsGrowthRatioTTM', 'pegRatio'])
      ?? pickNumber(finnhubMetric, ['pegRatio']),
    gross_margin: normalizePercent(ratiosRow.grossProfitMarginTTM ?? ratiosRow.grossMarginTTM ?? finnhubMetric.grossMarginTTM ?? finnhubMetric.grossMarginAnnual),
    operating_margin: normalizePercent(ratiosRow.operatingProfitMarginTTM ?? ratiosRow.operatingMarginTTM ?? finnhubMetric.operatingMarginTTM ?? finnhubMetric.operatingMarginAnnual),
    net_margin: normalizePercent(ratiosRow.netProfitMarginTTM ?? ratiosRow.bottomLineProfitMarginTTM ?? finnhubMetric.netProfitMarginTTM ?? finnhubMetric.netProfitMarginAnnual),
    roe: normalizePercent(ratiosRow.returnOnEquityTTM ?? keyMetricsRow.returnOnEquityTTM ?? finnhubMetric.returnOnEquityTTM ?? finnhubMetric.returnOnEquityAnnual),
    roa: normalizePercent(ratiosRow.returnOnAssetsTTM ?? keyMetricsRow.returnOnAssetsTTM ?? finnhubMetric.returnOnAssetsTTM ?? finnhubMetric.returnOnAssetsAnnual),
    roic: normalizePercent(ratiosRow.returnOnInvestedCapitalTTM ?? keyMetricsRow.returnOnInvestedCapitalTTM ?? finnhubMetric.returnOnInvestedCapitalTTM ?? finnhubMetric.returnOnInvestedCapitalAnnual),
    current_ratio: pickNumber(ratiosRow, ['currentRatioTTM', 'currentRatio'])
      ?? pickNumber(keyMetricsRow, ['currentRatioTTM', 'currentRatio'])
      ?? pickNumber(finnhubMetric, ['currentRatioTTM', 'currentRatioAnnual']),
    quick_ratio: pickNumber(ratiosRow, ['quickRatioTTM', 'quickRatio'])
      ?? pickNumber(keyMetricsRow, ['quickRatioTTM', 'quickRatio'])
      ?? pickNumber(finnhubMetric, ['quickRatioTTM', 'quickRatioAnnual']),
    debt_to_equity: pickNumber(ratiosRow, ['debtToEquityRatioTTM', 'debtToEquityTTM', 'debtToEquity'])
      ?? pickNumber(keyMetricsRow, ['debtToEquityRatioTTM', 'debtToEquityTTM', 'debtToEquity'])
      ?? pickNumber(finnhubMetric, ['debtToEquityAnnual', 'debtToEquityTTM']),
    dividend_yield: normalizePercent(ratiosRow.dividendYieldTTM ?? keyMetricsRow.dividendYieldTTM ?? finnhubMetric.dividendYieldIndicatedAnnual),
    revenue_growth_rate: normalizePercent(finnhubMetric.revenueGrowthAnnual ?? finnhubMetric.revenueGrowthTTM),
    earnings_growth_rate: normalizePercent(finnhubMetric.earningsGrowthAnnual ?? finnhubMetric.earningsGrowthTTM),
    eps: pickNumber(keyMetricsRow, ['netIncomePerShareTTM', 'earningsPerShareTTM', 'epsTTM', 'epsAnnual', 'earningsPerShare'])
      ?? pickNumber(finnhubMetric, ['epsAnnual', 'epsTTM']),
    free_cash_flow_yield: normalizePercent(keyMetricsRow.freeCashFlowYieldTTM ?? ratiosRow.freeCashFlowOperatingCashFlowRatioTTM ?? finnhubMetric.freeCashFlowYieldTTM),
    week_52_high: pickNumber(finnhubMetric, ['52WeekHigh']) ?? pickNumber(keyMetricsRow, ['yearHighTTM', 'week52High']),
    week_52_low: pickNumber(finnhubMetric, ['52WeekLow']) ?? pickNumber(keyMetricsRow, ['yearLowTTM', 'week52Low']),
    raw: {
      profile: profileRow,
      key_metrics_ttm: keyMetricsRow,
      ratios_ttm: ratiosRow,
      finnhub_metric: finnhubMetric,
    },
  };

  return {
    data,
    sourceUrls: mergeSources([profile.url], [keyMetricsTtm.url], [ratiosTtm.url], [finnhubMetrics.url]),
  };
}

export interface HistoricalKeyRatiosInput {
  ticker: string;
  period: 'annual' | 'quarterly' | 'ttm';
  limit: number;
  report_period?: string;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}

export async function fetchHistoricalKeyRatios(input: HistoricalKeyRatiosInput): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeTicker(input.ticker);
  const period = normalizeStatementPeriod(input.period);
  const path = period === 'ttm' ? '/ratios-ttm' : '/ratios';
  const query = period === 'ttm'
    ? { symbol, page: 0, limit: input.limit }
    : { symbol, period, page: 0, limit: input.limit };
  const { data, url } = await fmpClient.get(path, query, { cacheable: true, ttlMs: TTL_6H });
  const rows = normalizeRatioRows(asArray<Rec>(data))
    .filter((row) => {
      const reportPeriod = asString(row.report_period);
      if (!reportPeriod) {
        return true;
      }

      if (input.report_period && reportPeriod !== input.report_period) {
        return false;
      }
      if (input.report_period_gt && reportPeriod <= input.report_period_gt) {
        return false;
      }
      if (input.report_period_gte && reportPeriod < input.report_period_gte) {
        return false;
      }
      if (input.report_period_lt && reportPeriod >= input.report_period_lt) {
        return false;
      }
      if (input.report_period_lte && reportPeriod > input.report_period_lte) {
        return false;
      }
      return true;
    })
    .slice(0, input.limit);

  return { data: rows, sourceUrls: [url] };
}

export interface AnalystEstimatesInput {
  ticker: string;
  period: 'annual' | 'quarterly';
}

export async function fetchAnalystEstimates(input: AnalystEstimatesInput): Promise<ToolDataResult<Rec>> {
  const symbol = normalizeTicker(input.ticker);
  const [estimates, summary, consensus] = await Promise.all([
    fmpClient.get('/analyst-estimates', { symbol, period: input.period, page: 0, limit: 10 }, { cacheable: true, ttlMs: TTL_6H }),
    fmpClient.get('/price-target-summary', { symbol }, { cacheable: true, ttlMs: TTL_6H }),
    fmpClient.get('/price-target-consensus', { symbol }, { cacheable: true, ttlMs: TTL_6H }),
  ]);

  const data = {
    estimates: asArray<Rec>(estimates.data).map((row) => normalizeAnalystEstimateRow(row)),
    price_targets: {
      summary: asRecord(asArray<Rec>(summary.data)[0] ?? summary.data),
      consensus: asRecord(asArray<Rec>(consensus.data)[0] ?? consensus.data),
    },
    raw: {
      estimates: estimates.data,
      summary: summary.data,
      consensus: consensus.data,
    },
  };

  return {
    data,
    sourceUrls: mergeSources([estimates.url], [summary.url], [consensus.url]),
  };
}

export interface EarningsInput {
  ticker: string;
}

export async function fetchEarnings(input: EarningsInput): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeTicker(input.ticker);
  const { data, url } = await finnhubClient.get('/stock/earnings', { symbol }, { cacheable: true, ttlMs: TTL_24H });
  const rows = asArray<Rec>(data)
    .map((row) => normalizeEarningsRow(row, symbol));

  return { data: rows, sourceUrls: [url] };
}

export interface SegmentedRevenueInput {
  ticker: string;
  period: 'annual' | 'quarterly';
  limit: number;
}

export async function fetchSegmentedRevenues(input: SegmentedRevenueInput): Promise<ToolDataResult<Rec[]>> {
  const symbol = normalizeTicker(input.ticker);
  const period = input.period === 'quarterly' ? 'quarter' : 'annual';
  const [product, geographic] = await Promise.all([
    fmpClient.get('/revenue-product-segmentation', { symbol, period }, { cacheable: true, ttlMs: TTL_24H }),
    fmpClient.get('/revenue-geographic-segmentation', { symbol, period }, { cacheable: true, ttlMs: TTL_24H }),
  ]);

  const productRows = asArray<Rec>(product.data);
  const geographicRows = asArray<Rec>(geographic.data);
  const merged = [...productRows, ...geographicRows]
    .map((row) => ({
      report_period: toDayString(row.date ?? row.report_period ?? row.period),
      fiscal_period: asString(row.period ?? row.fiscalPeriod),
      segments: asArray<Rec>(row.segments ?? row.revenue_segments ?? row.items).map((segment) => ({
        label: pickString(segment, ['label', 'name', 'segment', 'region']),
        value: asNumber(segment.value ?? segment.revenue ?? segment.amount),
      })),
      raw: row,
    }))
    .slice(0, input.limit);

  return {
    data: merged,
    sourceUrls: mergeSources([product.url], [geographic.url]),
  };
}

// ---------------------------------------------------------------------------
// SEC helpers
// ---------------------------------------------------------------------------

export async function fetchSecCompanyTickers(): Promise<ToolDataResult<Rec[]>> {
  const { data, url } = await secClient.get('/files/company_tickers.json', {}, { cacheable: true, ttlMs: TTL_24H });
  const rows = Object.values(asRecord(data)).map((row) => asRecord(row)).map((row) => ({
    cik: pickString(row, ['cik_str', 'cik']),
    ticker: pickString(row, ['ticker']),
    title: pickString(row, ['title', 'name']),
    raw: row,
  }));

  return { data: rows, sourceUrls: [url] };
}
