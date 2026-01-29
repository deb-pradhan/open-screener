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
  | 'momentum';

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
};

// Helper to get presets by category
export function getPresetsByCategory(category: PresetCategory): Array<{ id: string } & PresetFilterMeta> {
  return Object.entries(PRESET_FILTERS)
    .filter(([_, preset]) => preset.category === category)
    .map(([id, preset]) => ({ id, ...preset }));
}
