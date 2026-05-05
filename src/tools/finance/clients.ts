import { readCache, writeCache } from '../../utils/cache.js';

type QueryValue = string | number | boolean | null | undefined | QueryValue[];

export type QueryParams = Record<string, QueryValue>;

type AuthMode =
  | { kind: 'query'; name: string; envVar: string }
  | { kind: 'header'; name: string; envVar: string };

interface JsonClientConfig {
  name: string;
  baseUrl: string;
  auth?: AuthMode;
  defaultHeaders?: Record<string, string>;
}

interface RequestOptions {
  cacheable?: boolean;
  ttlMs?: number;
  headers?: Record<string, string>;
}

export interface JsonClient {
  get<T = unknown>(
    path: string,
    params?: QueryParams,
    options?: RequestOptions,
  ): Promise<{ data: T; url: string }>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function compactParams(
  params: QueryParams = {},
): Record<string, string | number | string[] | undefined> {
  const compacted: Record<string, string | number | string[] | undefined> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      const items = value
        .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
        .filter((entry) => entry !== undefined && entry !== null)
        .map((entry) => String(entry));

      if (items.length > 0) {
        compacted[key] = items;
      }
      continue;
    }

    compacted[key] = typeof value === 'boolean' ? String(value) : value;
  }

  return compacted;
}

function appendParams(url: URL, params: QueryParams = {}): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    url.searchParams.append(key, String(value));
  }
}

function sanitizeUrl(url: URL, auth?: AuthMode): string {
  const cleaned = new URL(url.toString());
  const sensitiveKeys = new Set(['apikey', 'apiKey', 'token', 'access_token']);

  for (const key of [...cleaned.searchParams.keys()]) {
    if (sensitiveKeys.has(key) || (auth?.kind === 'query' && key === auth.name)) {
      cleaned.searchParams.delete(key);
    }
  }

  return cleaned.toString();
}

function getAuthValue(auth?: AuthMode): string | undefined {
  if (!auth) {
    return undefined;
  }

  const value = process.env[auth.envVar]?.trim();
  return value && value.length > 0 ? value : undefined;
}

async function parseJsonResponse(response: Response, label: string): Promise<unknown> {
  const text = await response.text().catch(() => '');

  if (!response.ok) {
    const detail = text.trim().slice(0, 300);
    throw new Error(
      detail
        ? `[${label}] request failed: ${response.status} ${response.statusText} — ${detail}`
        : `[${label}] request failed: ${response.status} ${response.statusText}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    const detail = text.trim().slice(0, 300);
    throw new Error(
      detail
        ? `[${label}] invalid JSON response — ${detail}`
        : `[${label}] invalid JSON response`,
    );
  }
}

export function createJsonClient(config: JsonClientConfig): JsonClient {
  return {
    async get<T = unknown>(
      path: string,
      params: QueryParams = {},
      options?: RequestOptions,
    ): Promise<{ data: T; url: string }> {
      const queryParams = compactParams(params);
      const authValue = getAuthValue(config.auth);
      const cacheEndpoint = `${config.name}:${path}`;

      if (options?.cacheable) {
        const cached = readCache(cacheEndpoint, queryParams, options.ttlMs);
        if (cached) {
          return { data: cached.data as T, url: cached.url };
        }
      }

      const requestUrl = new URL(joinUrl(config.baseUrl, path));
      appendParams(requestUrl, params);

      if (config.auth?.kind === 'query' && authValue) {
        requestUrl.searchParams.set(config.auth.name, authValue);
      }

      const headers: Record<string, string> = {
        ...(config.defaultHeaders ?? {}),
        ...(options?.headers ?? {}),
      };

      if (config.auth?.kind === 'header' && authValue) {
        headers[config.auth.name] = authValue;
      }

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers,
      });

      const data = await parseJsonResponse(response, `${config.name} ${path}`);
      const displayUrl = sanitizeUrl(requestUrl, config.auth);

      if (options?.cacheable) {
        writeCache(cacheEndpoint, queryParams, data as Record<string, unknown>, displayUrl);
      }

      return { data: data as T, url: displayUrl };
    },
  };
}

export const finnhubClient = createJsonClient({
  name: 'finnhub',
  baseUrl: 'https://finnhub.io/api/v1',
  auth: { kind: 'query', name: 'token', envVar: 'FINNHUB_API_KEY' },
});

export const fmpClient = createJsonClient({
  name: 'fmp',
  baseUrl: 'https://financialmodelingprep.com/stable',
  auth: { kind: 'header', name: 'apikey', envVar: 'FMP_API_KEY' },
});

export const polygonClient = createJsonClient({
  name: 'polygon',
  baseUrl: 'https://api.polygon.io',
  auth: { kind: 'query', name: 'apiKey', envVar: 'POLYGON_API_KEY' },
});

export const secClient = createJsonClient({
  name: 'sec',
  baseUrl: 'https://www.sec.gov',
  defaultHeaders: {
    'User-Agent': 'Dexter/2026.5.1 (+https://github.com/virattt/dexter)',
    Accept: 'application/json,text/plain,*/*',
  },
});

