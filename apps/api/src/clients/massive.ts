import type { 
  Ticker, 
  TickerSnapshot, 
  IndicatorValue,
  MACDValue 
} from '@screener/shared';

const BASE_URL = 'https://api.polygon.io';

interface MassiveAPIResponse<T> {
  status: string;
  request_id: string;
  results?: T;
  ticker?: string;
  queryCount?: number;
  resultsCount?: number;
  adjusted?: boolean;
  count?: number;
  next_url?: string;
  tickers?: T;
}

interface IndicatorAPIResponse {
  results: {
    underlying?: {
      url: string;
    };
    values: Array<{
      timestamp: number;
      value: number;
      signal?: number;
      histogram?: number;
    }>;
  };
  status: string;
  request_id: string;
  next_url?: string;
}

export class MassiveClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    // Bun auto-loads .env, but we need to ensure we're reading from the right place
    this.apiKey = process.env.MASSIVE_API_KEY || Bun.env.MASSIVE_API_KEY || '';
    this.baseUrl = BASE_URL;
    
    console.log(`MassiveClient initialized. API Key present: ${!!this.apiKey}, Key length: ${this.apiKey.length}`);
    
    if (!this.apiKey) {
      console.warn('MASSIVE_API_KEY not set. API calls will fail.');
    }
  }

  // Make authenticated request
  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('apiKey', this.apiKey);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`API request failed: ${response.status} ${response.statusText}`);
        return null;
      }

      return response.json();
    } catch (error) {
      console.error('API request error:', error);
      return null;
    }
  }

  // ==================== Reference Data ====================

  // Get all tickers
  async getTickers(params: {
    market?: string;
    type?: string;
    active?: boolean;
    limit?: number;
    search?: string;
  } = {}): Promise<Ticker[]> {
    const response = await this.request<MassiveAPIResponse<Ticker[]>>('/v3/reference/tickers', {
      market: params.market || 'stocks',
      active: params.active !== false ? 'true' : 'false',
      limit: params.limit || 1000,
      ...(params.search && { search: params.search }),
      ...(params.type && { type: params.type }),
    });

    return response?.results || [];
  }

  // Get all tickers with pagination
  async getAllTickers(): Promise<Ticker[]> {
    const allTickers: Ticker[] = [];
    let nextUrl: string | undefined;

    do {
      const url = nextUrl || '/v3/reference/tickers?market=stocks&active=true&limit=1000';
      const response = await this.request<MassiveAPIResponse<Ticker[]>>(
        nextUrl ? new URL(nextUrl).pathname + new URL(nextUrl).search : url
      );

      if (response?.results) {
        allTickers.push(...response.results);
      }

      nextUrl = response?.next_url;
      
      // Rate limiting: small delay between requests
      if (nextUrl) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (nextUrl);

    return allTickers;
  }

  // ==================== Snapshots ====================

  // Get full market snapshot
  async getMarketSnapshot(): Promise<TickerSnapshot[]> {
    const response = await this.request<MassiveAPIResponse<TickerSnapshot[]>>(
      '/v2/snapshot/locale/us/markets/stocks/tickers'
    );

    return response?.tickers || [];
  }

  // Get single ticker snapshot
  async getTickerSnapshot(symbol: string): Promise<TickerSnapshot | null> {
    const response = await this.request<MassiveAPIResponse<{ ticker: TickerSnapshot }>>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`
    );

    return response?.results?.ticker || null;
  }

  // ==================== Aggregates (OHLCV) ====================

  // Get aggregates/bars
  async getAggregates(params: {
    symbol: string;
    multiplier: number;
    timespan: 'minute' | 'hour' | 'day' | 'week' | 'month';
    from: string; // YYYY-MM-DD or timestamp
    to: string;
    adjusted?: boolean;
    sort?: 'asc' | 'desc';
    limit?: number;
  }): Promise<Array<{
    c: number;
    h: number;
    l: number;
    o: number;
    t: number;
    v: number;
    vw: number;
    n?: number;
  }>> {
    const response = await this.request<MassiveAPIResponse<Array<{
      c: number;
      h: number;
      l: number;
      o: number;
      t: number;
      v: number;
      vw: number;
      n?: number;
    }>>>(`/v2/aggs/ticker/${params.symbol}/range/${params.multiplier}/${params.timespan}/${params.from}/${params.to}`, {
      adjusted: params.adjusted !== false ? 'true' : 'false',
      sort: params.sort || 'desc',
      limit: params.limit || 5000,
    });

    return response?.results || [];
  }

  // ==================== Technical Indicators ====================

  // Get RSI
  async getRSI(symbol: string, window: number = 14): Promise<IndicatorValue | null> {
    const response = await this.request<IndicatorAPIResponse>(
      `/v1/indicators/rsi/${symbol}`,
      {
        timespan: 'day',
        window,
        series_type: 'close',
        order: 'desc',
        limit: 1,
      }
    );

    const value = response?.results?.values?.[0];
    return value ? { timestamp: value.timestamp, value: value.value } : null;
  }

  // Get SMA
  async getSMA(symbol: string, window: number): Promise<IndicatorValue | null> {
    const response = await this.request<IndicatorAPIResponse>(
      `/v1/indicators/sma/${symbol}`,
      {
        timespan: 'day',
        window,
        series_type: 'close',
        order: 'desc',
        limit: 1,
      }
    );

    const value = response?.results?.values?.[0];
    return value ? { timestamp: value.timestamp, value: value.value } : null;
  }

  // Get EMA
  async getEMA(symbol: string, window: number): Promise<IndicatorValue | null> {
    const response = await this.request<IndicatorAPIResponse>(
      `/v1/indicators/ema/${symbol}`,
      {
        timespan: 'day',
        window,
        series_type: 'close',
        order: 'desc',
        limit: 1,
      }
    );

    const value = response?.results?.values?.[0];
    return value ? { timestamp: value.timestamp, value: value.value } : null;
  }

  // Get MACD
  async getMACD(
    symbol: string,
    shortWindow: number = 12,
    longWindow: number = 26,
    signalWindow: number = 9
  ): Promise<MACDValue | null> {
    const response = await this.request<IndicatorAPIResponse>(
      `/v1/indicators/macd/${symbol}`,
      {
        timespan: 'day',
        short_window: shortWindow,
        long_window: longWindow,
        signal_window: signalWindow,
        series_type: 'close',
        order: 'desc',
        limit: 1,
      }
    );

    const value = response?.results?.values?.[0];
    return value && value.signal !== undefined && value.histogram !== undefined
      ? {
          timestamp: value.timestamp,
          value: value.value,
          signal: value.signal,
          histogram: value.histogram,
        }
      : null;
  }

  // Get ticker details (includes branding/logo)
  async getTickerDetails(symbol: string): Promise<{
    name: string;
    market_cap?: number;
    branding?: {
      logo_url?: string;
      icon_url?: string;
    };
  } | null> {
    const response = await this.request<{
      results: {
        name: string;
        market_cap?: number;
        branding?: {
          logo_url?: string;
          icon_url?: string;
        };
      };
      status: string;
    }>(`/v3/reference/tickers/${symbol}`);

    if (!response?.results) return null;

    // Add API key to logo URLs if they exist
    const branding = response.results.branding;
    if (branding?.logo_url) {
      branding.logo_url = `${branding.logo_url}?apiKey=${this.apiKey}`;
    }
    if (branding?.icon_url) {
      branding.icon_url = `${branding.icon_url}?apiKey=${this.apiKey}`;
    }

    return {
      name: response.results.name,
      market_cap: response.results.market_cap,
      branding,
    };
  }
}
