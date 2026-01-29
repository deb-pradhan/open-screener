import { pgTable, text, timestamp, boolean, real, integer, jsonb, uuid, date, serial, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ============================================
// Tickers - Stock metadata
// ============================================
export const tickers = pgTable('tickers', {
  symbol: text('symbol').primaryKey(),
  name: text('name').notNull(),
  market: text('market').notNull(),
  locale: text('locale').notNull(),
  primaryExchange: text('primary_exchange'),
  type: text('type'),
  active: boolean('active').default(true),
  currencyName: text('currency_name'),
  cik: text('cik'),
  compositeFigi: text('composite_figi'),
  sector: text('sector'),
  industry: text('industry'),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Daily Prices - Historical OHLCV data
// One row per symbol per day
// ============================================
export const dailyPrices = pgTable('daily_prices', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  open: real('open').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  close: real('close').notNull(),
  volume: real('volume').notNull(),
  vwap: real('vwap'),
  changePercent: real('change_percent'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolDateIdx: uniqueIndex('daily_prices_symbol_date_idx').on(table.symbol, table.date),
  dateIdx: index('daily_prices_date_idx').on(table.date),
  symbolIdx: index('daily_prices_symbol_idx').on(table.symbol),
}));

// ============================================
// Daily Indicators - Calculated technical indicators
// One row per symbol per day
// ============================================
export const dailyIndicators = pgTable('daily_indicators', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  rsi14: real('rsi14'),
  sma20: real('sma20'),
  sma50: real('sma50'),
  sma200: real('sma200'),
  ema12: real('ema12'),
  ema26: real('ema26'),
  macdValue: real('macd_value'),
  macdSignal: real('macd_signal'),
  macdHistogram: real('macd_histogram'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolDateIdx: uniqueIndex('daily_indicators_symbol_date_idx').on(table.symbol, table.date),
  dateIdx: index('daily_indicators_date_idx').on(table.date),
  symbolIdx: index('daily_indicators_symbol_idx').on(table.symbol),
}));

// ============================================
// Latest Snapshot - Denormalized current data
// Fast screener queries without joins
// Updated hourly during market hours, daily after close
// ============================================
export const latestSnapshot = pgTable('latest_snapshot', {
  symbol: text('symbol').primaryKey().references(() => tickers.symbol, { onDelete: 'cascade' }),
  name: text('name'),
  logoUrl: text('logo_url'),
  // Price data
  price: real('price').notNull(),
  open: real('open'),
  high: real('high'),
  low: real('low'),
  volume: real('volume').notNull(),
  vwap: real('vwap'),
  changePercent: real('change_percent'),
  // Indicators
  rsi14: real('rsi14'),
  sma20: real('sma20'),
  sma50: real('sma50'),
  sma200: real('sma200'),
  ema12: real('ema12'),
  ema26: real('ema26'),
  macdValue: real('macd_value'),
  macdSignal: real('macd_signal'),
  macdHistogram: real('macd_histogram'),
  // Metadata
  dataDate: date('data_date').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Indexes for common screener queries
  priceIdx: index('latest_snapshot_price_idx').on(table.price),
  volumeIdx: index('latest_snapshot_volume_idx').on(table.volume),
  rsiIdx: index('latest_snapshot_rsi_idx').on(table.rsi14),
  changeIdx: index('latest_snapshot_change_idx').on(table.changePercent),
  sma200Idx: index('latest_snapshot_sma200_idx').on(table.sma200),
}));

// ============================================
// Sync Log - Track data synchronization jobs
// ============================================
export const syncLog = pgTable('sync_log', {
  id: serial('id').primaryKey(),
  syncType: text('sync_type').notNull(), // 'snapshot', 'indicators', 'daily', 'backfill'
  status: text('status').notNull(), // 'started', 'completed', 'failed'
  tickersProcessed: integer('tickers_processed').default(0),
  tickersFailed: integer('tickers_failed').default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'), // Additional context
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('sync_log_status_idx').on(table.status),
  typeIdx: index('sync_log_type_idx').on(table.syncType),
}));

// ============================================
// User Filter Presets - Saved custom screens
// ============================================
export const filterPresets = pgTable('filter_presets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  conditions: jsonb('conditions').notNull(),
  sortBy: text('sort_by'),
  sortOrder: text('sort_order'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Type exports for TypeScript
// ============================================
export type NewTicker = typeof tickers.$inferInsert;
export type Ticker = typeof tickers.$inferSelect;

export type NewDailyPrice = typeof dailyPrices.$inferInsert;
export type DailyPrice = typeof dailyPrices.$inferSelect;

export type NewDailyIndicator = typeof dailyIndicators.$inferInsert;
export type DailyIndicator = typeof dailyIndicators.$inferSelect;

export type NewLatestSnapshot = typeof latestSnapshot.$inferInsert;
export type LatestSnapshot = typeof latestSnapshot.$inferSelect;

export type NewSyncLog = typeof syncLog.$inferInsert;
export type SyncLog = typeof syncLog.$inferSelect;

export type NewFilterPreset = typeof filterPresets.$inferInsert;
export type FilterPreset = typeof filterPresets.$inferSelect;
