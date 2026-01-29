import type { 
  Ticker, 
  TickerSnapshot, 
  IndicatorValue,
  MACDValue,
  CompanyDetails,
  CompanyAddress,
  PolygonIncomeStatement,
  PolygonBalanceSheet,
  PolygonCashFlowStatement,
  FinancialRatios,
  Dividend,
  StockSplit,
  NewsArticle,
  NewsPublisher,
  ChartBar,
} from '@screener/shared';

const BASE_URL = 'https://api.polygon.io';

// ============================================
// Error Classes
// ============================================
export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`);
    this.name = 'RateLimitError';
  }
}

export class APIError extends Error {
  constructor(public statusCode: number, public body: string) {
    super(`API error ${statusCode}: ${body}`);
    this.name = 'APIError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor() {
    super('Circuit breaker is open. API calls are temporarily disabled.');
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================
// Response Types
// ============================================
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
    underlying?: { url: string };
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

interface TickerDetailsResponse {
  results: {
    ticker: string;
    name: string;
    market: string;
    locale: string;
    primary_exchange: string;
    type: string;
    active: boolean;
    currency_name: string;
    cik?: string;
    composite_figi?: string;
    share_class_figi?: string;
    market_cap?: number;
    phone_number?: string;
    address?: {
      address1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    description?: string;
    sic_code?: string;
    sic_description?: string;
    ticker_root?: string;
    homepage_url?: string;
    total_employees?: number;
    list_date?: string;
    share_class_shares_outstanding?: number;
    branding?: {
      logo_url?: string;
      icon_url?: string;
    };
  };
  status: string;
}

interface FinancialsAPIResponse<T> {
  results: T[];
  status: string;
  request_id: string;
  next_url?: string;
}

interface RatiosAPIResponse {
  results: Array<{
    ticker: string;
    price_to_earnings_ratio?: number;
    price_to_book_ratio?: number;
    price_to_sales_ratio?: number;
    enterprise_value_to_ebitda?: number;
    peg_ratio?: number;
    gross_profit_margin?: number;
    operating_profit_margin?: number;
    net_profit_margin?: number;
    return_on_equity?: number;
    return_on_assets?: number;
    return_on_invested_capital?: number;
    current_ratio?: number;
    quick_ratio?: number;
    debt_to_equity?: number;
    interest_coverage?: number;
  }>;
  status: string;
}

interface DividendsAPIResponse {
  results: Array<{
    ticker: string;
    ex_dividend_date: string;
    pay_date?: string;
    record_date?: string;
    declaration_date?: string;
    cash_amount: number;
    frequency?: number;
    dividend_type?: string;
  }>;
  status: string;
  next_url?: string;
}

interface SplitsAPIResponse {
  results: Array<{
    ticker: string;
    execution_date: string;
    split_from: number;
    split_to: number;
  }>;
  status: string;
  next_url?: string;
}

interface NewsAPIResponse {
  results: Array<{
    id: string;
    published_utc: string;
    title: string;
    author?: string;
    article_url?: string;
    image_url?: string;
    description?: string;
    keywords?: string[];
    tickers?: string[];
    publisher?: {
      name: string;
      homepage_url?: string;
      logo_url?: string;
      favicon_url?: string;
    };
  }>;
  status: string;
  next_url?: string;
}

// ============================================
// MassiveClient with Resilience Patterns
// ============================================
export class MassiveClient {
  private apiKey: string;
  private baseUrl: string;

  // Circuit breaker state
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  // Rate limiter (token bucket)
  private tokens = 100;
  private lastRefill = Date.now();
  private readonly maxTokens = 100;
  private readonly refillRate = 5; // tokens per second

  constructor() {
    this.apiKey = process.env.MASSIVE_API_KEY || Bun.env.MASSIVE_API_KEY || '';
    this.baseUrl = BASE_URL;
    
    console.log(`MassiveClient initialized. API Key present: ${!!this.apiKey}, Key length: ${this.apiKey.length}`);
    
    if (!this.apiKey) {
      console.warn('MASSIVE_API_KEY not set. API calls will fail.');
    }
  }

  // ============================================
  // Circuit Breaker & Rate Limiting
  // ============================================
  
  getCircuitState(): 'closed' | 'open' | 'half-open' {
    return this.circuitState;
  }

  private async acquireToken(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    
    // Refill tokens based on elapsed time
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      // Wait for token to become available
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await this.sleep(waitTime);
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async requestWithRetry<T>(
    endpoint: string,
    params: Record<string, string | number> = {},
    retries = 3
  ): Promise<T | null> {
    // Check circuit breaker
    if (this.circuitState === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.circuitState = 'half-open';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    // Rate limiting
    await this.acquireToken();

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.request<T>(endpoint, params);
        
        // Success - reset circuit breaker
        if (this.circuitState === 'half-open') {
          this.circuitState = 'closed';
          this.failureCount = 0;
        }
        
        return response;
      } catch (error) {
        if (error instanceof RateLimitError) {
          // Back off on 429
          const backoff = Math.min(error.retryAfterSeconds * 1000, Math.pow(2, attempt) * 1000);
          console.warn(`Rate limited. Waiting ${backoff}ms before retry...`);
          await this.sleep(backoff);
          continue;
        }
        
        // Don't retry or trigger circuit breaker for auth errors (403)
        if (error instanceof APIError && (error.statusCode === 403 || error.statusCode === 401)) {
          // Auth errors are not transient - throw immediately without retry
          throw error;
        }
        
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.circuitState = 'open';
          this.lastFailureTime = Date.now();
          console.error('Circuit breaker opened due to repeated failures');
        }
        
        if (attempt === retries - 1) throw error;
        
        // Exponential backoff for other errors
        const backoff = Math.pow(2, attempt) * 500;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`Request failed (${errMsg}), retrying in ${backoff}ms...`);
        await this.sleep(backoff);
      }
    }
    return null;
  }

  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('apiKey', this.apiKey);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString());
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(parseInt(retryAfter || '60', 10));
    }
    
    if (!response.ok) {
      const body = await response.text();
      throw new APIError(response.status, body);
    }

    return response.json();
  }

  // ============================================
  // Reference Data
  // ============================================

  async getTickers(params: {
    market?: string;
    type?: string;
    active?: boolean;
    limit?: number;
    search?: string;
  } = {}): Promise<Ticker[]> {
    const response = await this.requestWithRetry<MassiveAPIResponse<Ticker[]>>('/v3/reference/tickers', {
      market: params.market || 'stocks',
      active: params.active !== false ? 'true' : 'false',
      limit: params.limit || 1000,
      ...(params.search && { search: params.search }),
      ...(params.type && { type: params.type }),
    });

    return response?.results || [];
  }

  async getAllTickers(): Promise<Ticker[]> {
    const allTickers: Ticker[] = [];
    let nextUrl: string | undefined;

    do {
      const url = nextUrl || '/v3/reference/tickers?market=stocks&active=true&limit=1000';
      const response = await this.requestWithRetry<MassiveAPIResponse<Ticker[]>>(
        nextUrl ? new URL(nextUrl).pathname + new URL(nextUrl).search : url
      );

      if (response?.results) {
        allTickers.push(...response.results);
      }

      nextUrl = response?.next_url;
      
      if (nextUrl) {
        await this.sleep(100);
      }
    } while (nextUrl);

    return allTickers;
  }

  // ============================================
  // Snapshots
  // ============================================

  async getMarketSnapshot(): Promise<TickerSnapshot[]> {
    const response = await this.requestWithRetry<MassiveAPIResponse<TickerSnapshot[]>>(
      '/v2/snapshot/locale/us/markets/stocks/tickers'
    );

    return response?.tickers || [];
  }

  async getTickerSnapshot(symbol: string): Promise<TickerSnapshot | null> {
    const response = await this.requestWithRetry<{ ticker: TickerSnapshot; status: string }>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`
    );

    return response?.ticker || null;
  }

  // ============================================
  // Aggregates (OHLCV)
  // ============================================

  async getAggregates(params: {
    symbol: string;
    multiplier: number;
    timespan: 'minute' | 'hour' | 'day' | 'week' | 'month';
    from: string;
    to: string;
    adjusted?: boolean;
    sort?: 'asc' | 'desc';
    limit?: number;
  }): Promise<ChartBar[]> {
    const response = await this.requestWithRetry<MassiveAPIResponse<ChartBar[]>>(
      `/v2/aggs/ticker/${params.symbol}/range/${params.multiplier}/${params.timespan}/${params.from}/${params.to}`,
      {
        adjusted: params.adjusted !== false ? 'true' : 'false',
        sort: params.sort || 'desc',
        limit: params.limit || 5000,
      }
    );

    return response?.results || [];
  }

  // ============================================
  // Technical Indicators
  // ============================================

  async getRSI(symbol: string, window: number = 14): Promise<IndicatorValue | null> {
    const response = await this.requestWithRetry<IndicatorAPIResponse>(
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

  async getSMA(symbol: string, window: number): Promise<IndicatorValue | null> {
    const response = await this.requestWithRetry<IndicatorAPIResponse>(
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

  async getEMA(symbol: string, window: number): Promise<IndicatorValue | null> {
    const response = await this.requestWithRetry<IndicatorAPIResponse>(
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

  async getMACD(
    symbol: string,
    shortWindow: number = 12,
    longWindow: number = 26,
    signalWindow: number = 9
  ): Promise<MACDValue | null> {
    const response = await this.requestWithRetry<IndicatorAPIResponse>(
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

  // ============================================
  // Ticker Details (Basic)
  // ============================================

  async getTickerDetails(symbol: string): Promise<{
    name: string;
    market_cap?: number;
    branding?: {
      logo_url?: string;
      icon_url?: string;
    };
  } | null> {
    const response = await this.requestWithRetry<TickerDetailsResponse>(
      `/v3/reference/tickers/${symbol}`
    );

    if (!response?.results) return null;

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

  // ============================================
  // Extended Ticker Details (Full Company Info)
  // ============================================

  async getTickerDetailsExtended(symbol: string): Promise<CompanyDetails | null> {
    const response = await this.requestWithRetry<TickerDetailsResponse>(
      `/v3/reference/tickers/${symbol}`
    );

    if (!response?.results) return null;

    const r = response.results;
    
    const address: CompanyAddress | undefined = r.address ? {
      address1: r.address.address1,
      city: r.address.city,
      state: r.address.state,
      postalCode: r.address.postal_code,
      country: r.address.country,
    } : undefined;

    return {
      symbol: r.ticker,
      description: r.description,
      homepageUrl: r.homepage_url,
      phoneNumber: r.phone_number,
      address,
      sicCode: r.sic_code,
      sicDescription: r.sic_description,
      totalEmployees: r.total_employees,
      listDate: r.list_date,
      marketCap: r.market_cap,
      sharesOutstanding: r.share_class_shares_outstanding,
    };
  }

  // ============================================
  // Financial Statements
  // ============================================

  async getIncomeStatements(symbol: string, params?: {
    timeframe?: 'quarterly' | 'annual' | 'ttm';
    limit?: number;
    filing_date_gte?: string;
  }): Promise<PolygonIncomeStatement[]> {
    const response = await this.requestWithRetry<FinancialsAPIResponse<PolygonIncomeStatement>>(
      '/stocks/financials/v1/income-statements',
      {
        ticker: symbol,
        timeframe: params?.timeframe || 'quarterly',
        limit: params?.limit || 10,
        ...(params?.filing_date_gte && { 'filing_date.gte': params.filing_date_gte }),
      }
    );

    return response?.results || [];
  }

  async getBalanceSheets(symbol: string, params?: {
    timeframe?: 'quarterly' | 'annual' | 'ttm';
    limit?: number;
  }): Promise<PolygonBalanceSheet[]> {
    const response = await this.requestWithRetry<FinancialsAPIResponse<PolygonBalanceSheet>>(
      '/stocks/financials/v1/balance-sheets',
      {
        ticker: symbol,
        timeframe: params?.timeframe || 'quarterly',
        limit: params?.limit || 10,
      }
    );

    return response?.results || [];
  }

  async getCashFlowStatements(symbol: string, params?: {
    timeframe?: 'quarterly' | 'annual' | 'ttm';
    limit?: number;
  }): Promise<PolygonCashFlowStatement[]> {
    const response = await this.requestWithRetry<FinancialsAPIResponse<PolygonCashFlowStatement>>(
      '/stocks/financials/v1/cash-flow-statements',
      {
        ticker: symbol,
        timeframe: params?.timeframe || 'quarterly',
        limit: params?.limit || 10,
      }
    );

    return response?.results || [];
  }

  // ============================================
  // Financial Ratios
  // ============================================

  async getFinancialRatios(symbol: string): Promise<FinancialRatios | null> {
    const response = await this.requestWithRetry<RatiosAPIResponse>(
      '/stocks/financials/v1/ratios',
      { ticker: symbol }
    );

    const r = response?.results?.[0];
    if (!r) return null;

    return {
      symbol: r.ticker,
      peRatio: r.price_to_earnings_ratio,
      pbRatio: r.price_to_book_ratio,
      psRatio: r.price_to_sales_ratio,
      evToEbitda: r.enterprise_value_to_ebitda,
      pegRatio: r.peg_ratio,
      grossMargin: r.gross_profit_margin,
      operatingMargin: r.operating_profit_margin,
      netMargin: r.net_profit_margin,
      roe: r.return_on_equity,
      roa: r.return_on_assets,
      roic: r.return_on_invested_capital,
      currentRatio: r.current_ratio,
      quickRatio: r.quick_ratio,
      debtToEquity: r.debt_to_equity,
      interestCoverage: r.interest_coverage,
    };
  }

  // ============================================
  // Dividends
  // ============================================

  async getDividends(symbol: string, params?: {
    limit?: number;
    ex_dividend_date_gte?: string;
  }): Promise<Dividend[]> {
    const response = await this.requestWithRetry<DividendsAPIResponse>(
      '/stocks/v1/dividends',
      {
        ticker: symbol,
        limit: params?.limit || 50,
        ...(params?.ex_dividend_date_gte && { 'ex_dividend_date.gte': params.ex_dividend_date_gte }),
      }
    );

    return (response?.results || []).map(d => ({
      symbol: d.ticker,
      exDividendDate: d.ex_dividend_date,
      payDate: d.pay_date,
      recordDate: d.record_date,
      declarationDate: d.declaration_date,
      amount: d.cash_amount,
      frequency: d.frequency,
      dividendType: d.dividend_type,
    }));
  }

  // ============================================
  // Stock Splits
  // ============================================

  async getStockSplits(symbol: string, params?: {
    limit?: number;
    execution_date_gte?: string;
  }): Promise<StockSplit[]> {
    const response = await this.requestWithRetry<SplitsAPIResponse>(
      '/stocks/v1/splits',
      {
        ticker: symbol,
        limit: params?.limit || 50,
        ...(params?.execution_date_gte && { 'execution_date.gte': params.execution_date_gte }),
      }
    );

    return (response?.results || []).map(s => ({
      symbol: s.ticker,
      executionDate: s.execution_date,
      splitFrom: s.split_from,
      splitTo: s.split_to,
    }));
  }

  // ============================================
  // News
  // ============================================

  async getNews(params?: {
    ticker?: string;
    limit?: number;
    published_utc_gte?: string;
    order?: 'asc' | 'desc';
  }): Promise<NewsArticle[]> {
    const response = await this.requestWithRetry<NewsAPIResponse>(
      '/v2/reference/news',
      {
        limit: params?.limit || 50,
        order: params?.order || 'desc',
        ...(params?.ticker && { ticker: params.ticker }),
        ...(params?.published_utc_gte && { 'published_utc.gte': params.published_utc_gte }),
      }
    );

    return (response?.results || []).map(n => {
      const publisher: NewsPublisher | undefined = n.publisher ? {
        name: n.publisher.name,
        homepage_url: n.publisher.homepage_url,
        logo_url: n.publisher.logo_url,
        favicon_url: n.publisher.favicon_url,
      } : undefined;

      return {
        id: n.id,
        publishedAt: n.published_utc,
        title: n.title,
        author: n.author,
        articleUrl: n.article_url,
        imageUrl: n.image_url,
        description: n.description,
        keywords: n.keywords,
        tickers: n.tickers,
        publisher,
      };
    });
  }
}
