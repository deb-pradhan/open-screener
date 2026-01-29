// Stock ticker types
export interface Ticker {
  symbol: string;
  name: string;
  market: string;
  locale: string;
  primaryExchange: string;
  type: string;
  active: boolean;
  currencyName: string;
  cik?: string;
  compositeFigi?: string;
}

// ============================================
// Company Details (Extended Ticker Info)
// ============================================
export interface CompanyAddress {
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CompanyDetails {
  symbol: string;
  description?: string;
  homepageUrl?: string;
  phoneNumber?: string;
  address?: CompanyAddress;
  sicCode?: string;
  sicDescription?: string;
  totalEmployees?: number;
  listDate?: string;
  delistDate?: string;
  marketCap?: number;
  sharesOutstanding?: number;
  lastSyncedAt?: string;
}

// ============================================
// Financial Statements
// ============================================
export type StatementType = 'income' | 'balance' | 'cashflow';
export type Timeframe = 'quarterly' | 'annual' | 'ttm';

export interface FinancialStatement {
  id?: number;
  symbol: string;
  statementType: StatementType;
  timeframe: Timeframe;
  fiscalYear: number;
  fiscalQuarter?: number;
  periodEnd: string;
  filingDate?: string;
  acceptedDate?: string;
  // Raw data for full access
  rawData: Record<string, unknown>;
  // Extracted common fields
  revenue?: number;
  netIncome?: number;
  eps?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  operatingCashFlow?: number;
}

// Polygon API response structures
export interface PolygonFinancialValue {
  value: number;
  unit?: string;
  label?: string;
  order?: number;
}

export interface PolygonIncomeStatement {
  fiscal_year: number;
  fiscal_period: string;
  start_date: string;
  end_date: string;
  filing_date?: string;
  acceptance_datetime?: string;
  timeframe: string;
  revenues?: PolygonFinancialValue;
  cost_of_revenue?: PolygonFinancialValue;
  gross_profit?: PolygonFinancialValue;
  operating_expenses?: PolygonFinancialValue;
  operating_income_loss?: PolygonFinancialValue;
  net_income_loss?: PolygonFinancialValue;
  basic_earnings_per_share?: PolygonFinancialValue;
  diluted_earnings_per_share?: PolygonFinancialValue;
  [key: string]: unknown;
}

export interface PolygonBalanceSheet {
  fiscal_year: number;
  fiscal_period: string;
  start_date: string;
  end_date: string;
  filing_date?: string;
  acceptance_datetime?: string;
  timeframe: string;
  assets?: PolygonFinancialValue;
  current_assets?: PolygonFinancialValue;
  liabilities?: PolygonFinancialValue;
  current_liabilities?: PolygonFinancialValue;
  equity?: PolygonFinancialValue;
  liabilities_and_equity?: PolygonFinancialValue;
  [key: string]: unknown;
}

export interface PolygonCashFlowStatement {
  fiscal_year: number;
  fiscal_period: string;
  start_date: string;
  end_date: string;
  filing_date?: string;
  acceptance_datetime?: string;
  timeframe: string;
  net_cash_flow_from_operating_activities?: PolygonFinancialValue;
  net_cash_flow_from_investing_activities?: PolygonFinancialValue;
  net_cash_flow_from_financing_activities?: PolygonFinancialValue;
  net_cash_flow?: PolygonFinancialValue;
  [key: string]: unknown;
}

// ============================================
// Financial Ratios
// ============================================
export interface FinancialRatios {
  symbol: string;
  // Valuation
  peRatio?: number;
  pbRatio?: number;
  psRatio?: number;
  evToEbitda?: number;
  pegRatio?: number;
  // Profitability
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  roe?: number;
  roa?: number;
  roic?: number;
  // Liquidity
  currentRatio?: number;
  quickRatio?: number;
  // Leverage
  debtToEquity?: number;
  interestCoverage?: number;
  // Metadata
  lastSyncedAt?: string;
}

// ============================================
// Dividends
// ============================================
export interface Dividend {
  id?: number;
  symbol: string;
  exDividendDate: string;
  payDate?: string;
  recordDate?: string;
  declarationDate?: string;
  amount: number;
  frequency?: number; // 1=annual, 2=semi, 4=quarterly, 12=monthly
  dividendType?: string; // 'CD' (cash), 'SC' (special cash), etc.
}

export interface DividendWithYield {
  dividends: Dividend[];
  trailingYield?: number;
}

// ============================================
// Stock Splits
// ============================================
export interface StockSplit {
  id?: number;
  symbol: string;
  executionDate: string;
  splitFrom: number;
  splitTo: number;
}

// ============================================
// News Articles
// ============================================
export interface NewsPublisher {
  name: string;
  homepage_url?: string;
  logo_url?: string;
  favicon_url?: string;
}

export interface NewsArticle {
  id: string;
  publishedAt: string;
  title: string;
  author?: string;
  articleUrl?: string;
  imageUrl?: string;
  description?: string;
  keywords?: string[];
  publisher?: NewsPublisher;
  tickers?: string[];
}

// ============================================
// Chart Data
// ============================================
export interface ChartBar {
  t: number;  // timestamp
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
  vw?: number; // vwap
  n?: number;  // number of trades
}

export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y' | 'MAX';

export interface ChartData {
  bars: ChartBar[];
  source: 'db' | 'api';
}

// ============================================
// Ticker Detail Page Types
// ============================================
export interface TickerCoreData {
  snapshot: LatestSnapshotData | null;
  company: CompanyDetails | null;
  ratios: FinancialRatios | null;
}

export interface LatestSnapshotData {
  symbol: string;
  name?: string;
  logoUrl?: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume: number;
  vwap?: number;
  changePercent?: number;
  // Technical indicators
  rsi14?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  macdValue?: number;
  macdSignal?: number;
  macdHistogram?: number;
  // Fundamental data
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  grossMargin?: number;
  revenueGrowthYoy?: number;
  epsGrowthYoy?: number;
  debtToEquity?: number;
  // Freshness tracking
  dataDate?: string;
  financialsLastSync?: string;
  ratiosLastSync?: string;
  updatedAt?: string;
}

export interface DataFreshness {
  snapshot?: string;
  ratios?: string;
  company?: string;
}

export interface TickerDetailResponse {
  success: boolean;
  data?: TickerCoreData;
  meta?: {
    freshness: DataFreshness;
    staleThresholdMs: number;
  };
  error?: string;
  timestamp: number;
}

export interface FinancialsResponse {
  success: boolean;
  data?: {
    income: FinancialStatement[];
    balance: FinancialStatement[];
    cashFlow: FinancialStatement[];
  };
  error?: string;
  timestamp: number;
}

// ============================================
// Sync Status Types
// ============================================
export type SyncDataType = 'financials' | 'dividends' | 'splits' | 'details' | 'ratios' | 'news';
export type SyncStatus = 'success' | 'failed' | 'partial' | 'pending';

export interface SyncStatusRecord {
  symbol: string;
  dataType: SyncDataType;
  lastSyncedAt?: string;
  lastSyncStatus?: SyncStatus;
  errorMessage?: string;
  retryCount: number;
  nextRetryAt?: string;
}

export interface SyncResult {
  status: 'completed' | 'skipped' | 'failed';
  reason?: string;
  processed?: number;
  failed?: number;
}

// Snapshot data from Massive API
export interface TickerSnapshot {
  ticker: string;
  day: {
    c: number; // close
    h: number; // high
    l: number; // low
    o: number; // open
    v: number; // volume
    vw: number; // vwap
  };
  lastQuote?: {
    P: number; // ask price
    S: number; // ask size
    p: number; // bid price
    s: number; // bid size
    t: number; // timestamp
  };
  lastTrade?: {
    c: number[]; // conditions
    i: string; // trade id
    p: number; // price
    s: number; // size
    t: number; // timestamp
    x: number; // exchange
  };
  min?: {
    av: number; // accumulated volume
    c: number; // close
    h: number; // high
    l: number; // low
    n: number; // number of trades
    o: number; // open
    t: number; // timestamp
    v: number; // volume
    vw: number; // vwap
  };
  prevDay: {
    c: number;
    h: number;
    l: number;
    o: number;
    v: number;
    vw: number;
  };
  todaysChange: number;
  todaysChangePerc: number;
  updated: number;
}

// Technical indicators
export interface IndicatorValue {
  timestamp: number;
  value: number;
}

export interface MACDValue {
  timestamp: number;
  value: number;
  signal: number;
  histogram: number;
}

export interface StockIndicators {
  symbol: string;
  name?: string;
  logo?: string;
  price: number;
  volume: number;
  changePercent: number;
  // Technical indicators
  rsi14?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  // Fundamental fields
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  epsGrowthYoy?: number;
  revenueGrowthYoy?: number;
  dividendYield?: number;
  grossMargin?: number;
  debtToEquity?: number;
  // Data freshness (for UI indicators)
  financialsLastSync?: string;
  ratiosLastSync?: string;
  updatedAt: number;
}

// Screener filter types
export type FilterOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between';

export interface FilterCondition {
  field: keyof StockIndicators;
  operator: FilterOperator;
  value: number | [number, number];
}

export interface ScreenerFilter {
  id: string;
  name: string;
  conditions: FilterCondition[];
  sortBy?: keyof StockIndicators;
  sortOrder?: 'asc' | 'desc';
}

export interface ScreenerResult {
  stocks: StockIndicators[];
  total: number;
  page: number;
  pageSize: number;
  filterId: string;
  timestamp: number;
}

// WebSocket message types
export type WSMessageType = 
  | 'subscribe'
  | 'unsubscribe'
  | 'filter_update'
  | 'screener_results'
  | 'stock_update'
  | 'error';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: number;
}

export interface WSSubscribePayload {
  filterId: string;
}

export interface WSScreenerResultsPayload {
  results: ScreenerResult;
}

export interface WSStockUpdatePayload {
  stock: StockIndicators;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Preset filter with metadata
export interface PresetFilterMeta extends Omit<ScreenerFilter, 'id'> {
  description: string;
  category: PresetCategory;
}

export type PresetCategory = 
  | 'technical'
  | 'moving_averages'
  | 'price_volume'
  | 'momentum'
  | 'fundamentals';

export interface PresetCategoryInfo {
  id: PresetCategory;
  name: string;
  description: string;
}

export const PRESET_CATEGORIES: PresetCategoryInfo[] = [
  {
    id: 'technical',
    name: 'Technical Signals',
    description: 'Screens based on RSI, MACD, and other technical indicators',
  },
  {
    id: 'moving_averages',
    name: 'Moving Averages',
    description: 'Crossovers and trend signals using SMA and EMA',
  },
  {
    id: 'price_volume',
    name: 'Price & Volume',
    description: 'Screens based on price action and volume activity',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'Identify stocks with strong directional movement',
  },
  {
    id: 'fundamentals',
    name: 'Fundamentals',
    description: 'Screens based on valuation, growth, and financial health',
  },
];

// Preset filters
export const PRESET_FILTERS: Record<string, PresetFilterMeta> = {
  // Technical Signals
  oversold: {
    name: 'RSI Oversold',
    description: 'Stocks with RSI below 30, potentially undervalued',
    category: 'technical',
    conditions: [
      { field: 'rsi14', operator: 'lt', value: 30 },
      { field: 'volume', operator: 'gt', value: 100000 },
    ],
    sortBy: 'rsi14',
    sortOrder: 'asc',
  },
  overbought: {
    name: 'RSI Overbought',
    description: 'Stocks with RSI above 70, potentially overextended',
    category: 'technical',
    conditions: [
      { field: 'rsi14', operator: 'gt', value: 70 },
      { field: 'volume', operator: 'gt', value: 100000 },
    ],
    sortBy: 'rsi14',
    sortOrder: 'desc',
  },
  rsiNeutral: {
    name: 'RSI Neutral Zone',
    description: 'Stocks with RSI between 40-60, balanced momentum',
    category: 'technical',
    conditions: [
      { field: 'rsi14', operator: 'gte', value: 40 },
      { field: 'rsi14', operator: 'lte', value: 60 },
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'volume',
    sortOrder: 'desc',
  },
  macdBullish: {
    name: 'MACD Bullish',
    description: 'Positive MACD histogram indicating bullish momentum',
    category: 'technical',
    conditions: [
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },

  // Moving Averages
  goldenCross: {
    name: 'Golden Cross Setup',
    description: 'Price above SMA50 which is above SMA200',
    category: 'moving_averages',
    conditions: [
      { field: 'volume', operator: 'gt', value: 200000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },
  deathCross: {
    name: 'Death Cross Setup',
    description: 'Price below SMA50 which is below SMA200',
    category: 'moving_averages',
    conditions: [
      { field: 'volume', operator: 'gt', value: 200000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'asc',
  },
  aboveSma200: {
    name: 'Above 200 SMA',
    description: 'Stocks trading above their 200-day moving average',
    category: 'moving_averages',
    conditions: [
      { field: 'volume', operator: 'gt', value: 100000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },
  belowSma200: {
    name: 'Below 200 SMA',
    description: 'Stocks trading below their 200-day moving average',
    category: 'moving_averages',
    conditions: [
      { field: 'volume', operator: 'gt', value: 100000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'asc',
  },
  emaCrossover: {
    name: 'EMA 12/26 Bullish',
    description: 'EMA12 crossing above EMA26',
    category: 'moving_averages',
    conditions: [
      { field: 'volume', operator: 'gt', value: 300000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },

  // Price & Volume
  highVolume: {
    name: 'High Volume Movers',
    description: 'Stocks with volume over 1M and significant price change',
    category: 'price_volume',
    conditions: [
      { field: 'volume', operator: 'gt', value: 1000000 },
      { field: 'changePercent', operator: 'gt', value: 2 },
    ],
    sortBy: 'volume',
    sortOrder: 'desc',
  },
  topGainers: {
    name: 'Top Gainers',
    description: 'Biggest percentage gainers of the day',
    category: 'price_volume',
    conditions: [
      { field: 'changePercent', operator: 'gt', value: 3 },
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },
  topLosers: {
    name: 'Top Losers',
    description: 'Biggest percentage losers of the day',
    category: 'price_volume',
    conditions: [
      { field: 'changePercent', operator: 'lt', value: -3 },
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'asc',
  },
  volumeSpike: {
    name: 'Volume Spike',
    description: 'Unusually high trading volume today',
    category: 'price_volume',
    conditions: [
      { field: 'volume', operator: 'gt', value: 2000000 },
    ],
    sortBy: 'volume',
    sortOrder: 'desc',
  },
  priceBreakout: {
    name: 'Price Breakout',
    description: 'Stocks up more than 5% with strong volume',
    category: 'price_volume',
    conditions: [
      { field: 'changePercent', operator: 'gt', value: 5 },
      { field: 'volume', operator: 'gt', value: 1000000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },

  // Momentum
  bullishMomentum: {
    name: 'Bullish Momentum',
    description: 'Strong upward momentum with RSI confirmation',
    category: 'momentum',
    conditions: [
      { field: 'changePercent', operator: 'gt', value: 1 },
      { field: 'rsi14', operator: 'gt', value: 50 },
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },
  bearishMomentum: {
    name: 'Bearish Momentum',
    description: 'Strong downward momentum with RSI confirmation',
    category: 'momentum',
    conditions: [
      { field: 'changePercent', operator: 'lt', value: -1 },
      { field: 'rsi14', operator: 'lt', value: 50 },
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'asc',
  },
  uptrend: {
    name: 'Strong Uptrend',
    description: 'Stocks in a confirmed uptrend above key averages',
    category: 'momentum',
    conditions: [
      { field: 'changePercent', operator: 'gt', value: 0 },
      { field: 'volume', operator: 'gt', value: 100000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'desc',
  },
  downtrend: {
    name: 'Strong Downtrend',
    description: 'Stocks in a confirmed downtrend below key averages',
    category: 'momentum',
    conditions: [
      { field: 'changePercent', operator: 'lt', value: 0 },
      { field: 'volume', operator: 'gt', value: 100000 },
    ],
    sortBy: 'changePercent',
    sortOrder: 'asc',
  },

  // Fundamentals
  valueStocks: {
    name: 'Value Stocks',
    description: 'Low P/E (<15) and low P/B (<2) with decent volume',
    category: 'fundamentals',
    conditions: [
      { field: 'peRatio', operator: 'lt', value: 15 },
      { field: 'peRatio', operator: 'gt', value: 0 },
      { field: 'pbRatio', operator: 'lt', value: 2 },
      { field: 'volume', operator: 'gt', value: 500000 },
    ],
    sortBy: 'peRatio',
    sortOrder: 'asc',
  },
  growthStocks: {
    name: 'Growth Stocks',
    description: 'Revenue growth >20% and EPS growth >15%',
    category: 'fundamentals',
    conditions: [
      { field: 'revenueGrowthYoy', operator: 'gt', value: 20 },
      { field: 'epsGrowthYoy', operator: 'gt', value: 15 },
      { field: 'volume', operator: 'gt', value: 300000 },
    ],
    sortBy: 'revenueGrowthYoy',
    sortOrder: 'desc',
  },
  dividendYielders: {
    name: 'Dividend Yielders',
    description: 'Dividend yield >3% with sustainable payout',
    category: 'fundamentals',
    conditions: [
      { field: 'dividendYield', operator: 'gt', value: 3 },
      { field: 'peRatio', operator: 'gt', value: 0 },
      { field: 'volume', operator: 'gt', value: 200000 },
    ],
    sortBy: 'dividendYield',
    sortOrder: 'desc',
  },
  highMargin: {
    name: 'High Margin',
    description: 'Gross margin >40%, indicating pricing power',
    category: 'fundamentals',
    conditions: [
      { field: 'grossMargin', operator: 'gt', value: 40 },
      { field: 'marketCap', operator: 'gt', value: 1000000000 },
      { field: 'volume', operator: 'gt', value: 200000 },
    ],
    sortBy: 'grossMargin',
    sortOrder: 'desc',
  },
  lowDebt: {
    name: 'Low Debt',
    description: 'Debt-to-equity <0.5, financially stable',
    category: 'fundamentals',
    conditions: [
      { field: 'debtToEquity', operator: 'lt', value: 0.5 },
      { field: 'debtToEquity', operator: 'gte', value: 0 },
      { field: 'volume', operator: 'gt', value: 300000 },
    ],
    sortBy: 'marketCap',
    sortOrder: 'desc',
  },
};

// Helper to get presets by category
export function getPresetsByCategory(category: PresetCategory): Array<{ id: string } & PresetFilterMeta> {
  return Object.entries(PRESET_FILTERS)
    .filter(([_, preset]) => preset.category === category)
    .map(([id, preset]) => ({ id, ...preset }));
}
