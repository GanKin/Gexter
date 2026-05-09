const TOOL_SUMMARY_FALLBACK = '…';
const MAX_QUERY_SUMMARY_LENGTH = 18;
const MAX_URL_SUMMARY_LENGTH = 24;

const QUERY_PREFIX_RE = /^(?:请|帮我|麻烦|请帮我|帮忙|分析一下|分析|查看一下|查看|研究一下|研究|查找一下|查找|比较一下|比较|对比一下|对比|看看|请看|tell me about|show me|find|search for|look up|analyze|analyse|review|summarize|summarise|explain|what is|what's|what are|what was|what were)\s*/i;

const ACTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b10-?k\b/i, label: '10-K' },
  { pattern: /\b10-?q\b/i, label: '10-Q' },
  { pattern: /\b8-?k\b/i, label: '8-K' },
  { pattern: /\bmarket cap\b/i, label: 'market cap' },
  { pattern: /\bprice\b/i, label: 'price' },
  { pattern: /\bearnings?\b/i, label: 'earnings' },
  { pattern: /\brevenue\b/i, label: 'revenue' },
  { pattern: /\bfinancials?\b/i, label: 'financials' },
  { pattern: /\bfilings?\b/i, label: 'filings' },
  { pattern: /\bnews\b/i, label: 'news' },
  { pattern: /\brisk factors?\b/i, label: 'risk factors' },
  { pattern: /\bguidance\b/i, label: 'guidance' },
  { pattern: /\bestimat(?:e|es)\b/i, label: 'estimates' },
  { pattern: /\bbalance sheet\b/i, label: 'balance sheet' },
  { pattern: /\bcash flow\b/i, label: 'cash flow' },
  { pattern: /\bincome statement\b/i, label: 'income statement' },
  { pattern: /\bcomparison\b/i, label: 'comparison' },
  { pattern: /\bcompare\b/i, label: 'compare' },
  { pattern: /财报/, label: '财报' },
  { pattern: /股价/, label: '股价' },
  { pattern: /市值/, label: '市值' },
  { pattern: /业绩/, label: '业绩' },
  { pattern: /收入/, label: '收入' },
  { pattern: /估值/, label: '估值' },
  { pattern: /披露/, label: '披露' },
  { pattern: /新闻/, label: '新闻' },
  { pattern: /风险因素/, label: '风险因素' },
  { pattern: /指引/, label: '指引' },
  { pattern: /现金流/, label: '现金流' },
  { pattern: /资产负债表/, label: '资产负债表' },
  { pattern: /利润表/, label: '利润表' },
  { pattern: /对比/, label: '对比' },
];

const COMPARISON_CUES = /(?:vs|\/|和|与|比较|对比|compare)/i;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function stripQueryPrefixes(text: string): string {
  return normalizeWhitespace(text).replace(QUERY_PREFIX_RE, '').trim();
}

function extractTickerLikeTokens(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/g) ?? [];
  const reserved = new Set([
    'IPO',
    'EPS',
    'EBITDA',
    'YOY',
    'TTM',
    'ROI',
    'ROE',
    'ROA',
    'SEC',
    'USD',
    'FY',
    'Q1',
    'Q2',
    'Q3',
    'Q4',
  ]);

  return [...new Set(matches.filter((token) => !reserved.has(token)))];
}

function findAction(text: string): { label: string; index: number } | null {
  for (const entry of ACTION_PATTERNS) {
    const match = text.match(entry.pattern);
    if (match && typeof match.index === 'number') {
      return { label: entry.label, index: match.index };
    }
  }
  return null;
}

function extractEntityFromText(text: string): string {
  const compact = normalizeWhitespace(text)
    .replace(/[“”'"'’]/g, '')
    .replace(/[的|：:，,。、;；]+$/g, '')
    .trim();

  if (!compact) {
    return '';
  }

  const firstChunk = compact.split(/[|/\\,，。:：;；\s]+/).filter(Boolean)[0] ?? compact;
  return truncate(firstChunk, MAX_QUERY_SUMMARY_LENGTH);
}

function summarizeQuery(query: string): string | null {
  const normalized = stripQueryPrefixes(query);
  if (!normalized) {
    return null;
  }

  const action = findAction(normalized);
  const tickerTokens = extractTickerLikeTokens(normalized);
  const entitySource = action ? normalized.slice(0, action.index) : normalized;
  const entity = extractEntityFromText(entitySource);

  if (tickerTokens.length > 0) {
    if (tickerTokens.length > 1 && COMPARISON_CUES.test(normalized)) {
      return tickerTokens.slice(0, 2).join(' / ');
    }

    if (action?.label) {
      return `${tickerTokens[0]} ${action.label}`;
    }

    if (entity && entity !== tickerTokens[0]) {
      return `${tickerTokens[0]} ${entity}`;
    }

    return tickerTokens[0];
  }

  if (action?.label) {
    if (entity && entity !== action.label) {
      return `${entity} ${action.label}`;
    }
    return action.label;
  }

  if (entity) {
    return entity;
  }

  return truncate(normalized, MAX_QUERY_SUMMARY_LENGTH);
}

function summarizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const base = parsed.hostname || parsed.host;

    if (pathParts.length === 0) {
      return base || truncate(url, MAX_URL_SUMMARY_LENGTH);
    }

    const tail = pathParts[0];
    return truncate(`${base ? `${base}/` : ''}${tail}`, MAX_URL_SUMMARY_LENGTH);
  } catch {
    const compact = normalizeWhitespace(url);
    const pathParts = compact.split(/[\\/]/).filter(Boolean);
    if (pathParts.length >= 2) {
      return truncate(pathParts.slice(-2).join('/'), MAX_URL_SUMMARY_LENGTH);
    }
    return truncate(compact, MAX_URL_SUMMARY_LENGTH);
  }
}

function summarizePath(path: string): string {
  const compact = normalizeWhitespace(path);
  const pathParts = compact.split(/[\\/]/).filter(Boolean);
  if (pathParts.length >= 2) {
    return truncate(pathParts.slice(-2).join('/'), MAX_URL_SUMMARY_LENGTH);
  }
  return truncate(compact, MAX_URL_SUMMARY_LENGTH);
}

function summarizeStructuredArgs(args: Record<string, unknown>): string | null {
  const query = args.query;
  if (typeof query === 'string' && query.trim()) {
    return summarizeQuery(query);
  }

  const ticker = args.ticker;
  const symbol = args.symbol;
  const filingType = args.filing_type;
  const skill = args.skill;

  if (typeof ticker === 'string' && ticker.trim()) {
    const label = typeof filingType === 'string' && filingType.trim() ? ` ${filingType.trim()}` : '';
    return `${ticker.trim()}${label}`;
  }

  if (typeof symbol === 'string' && symbol.trim()) {
    return symbol.trim();
  }

  if (typeof skill === 'string' && skill.trim()) {
    return typeof args.args === 'string' && args.args.trim()
      ? `${skill.trim()} ${truncate(args.args, MAX_QUERY_SUMMARY_LENGTH)}`
      : skill.trim();
  }

  const url = args.url;
  if (typeof url === 'string' && url.trim()) {
    return summarizeUrl(url);
  }

  const path = args.path;
  if (typeof path === 'string' && path.trim()) {
    return summarizePath(path);
  }

  if (typeof filingType === 'string' && filingType.trim()) {
    return filingType.trim();
  }

  const firstStringValue = Object.values(args).find((value) => typeof value === 'string' && value.trim());
  if (typeof firstStringValue === 'string') {
    return truncate(firstStringValue, MAX_QUERY_SUMMARY_LENGTH);
  }

  return null;
}

export function summarizeToolTarget(toolName: string, args?: Record<string, unknown>): string {
  const summary = args ? summarizeStructuredArgs(args) : null;
  if (summary && summary.trim()) {
    return summary;
  }

  return TOOL_SUMMARY_FALLBACK;
}
