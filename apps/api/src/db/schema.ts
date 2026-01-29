import { pgTable, text, timestamp, boolean, real, integer, jsonb, uuid } from 'drizzle-orm/pg-core';

// Ticker metadata table
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
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Historical indicator snapshots (for backtesting)
export const indicatorSnapshots = pgTable('indicator_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol),
  price: real('price').notNull(),
  volume: integer('volume').notNull(),
  changePercent: real('change_percent'),
  rsi14: real('rsi_14'),
  sma20: real('sma_20'),
  sma50: real('sma_50'),
  sma200: real('sma_200'),
  ema12: real('ema_12'),
  ema26: real('ema_26'),
  macdValue: real('macd_value'),
  macdSignal: real('macd_signal'),
  macdHistogram: real('macd_histogram'),
  snapshotAt: timestamp('snapshot_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// User-defined filter presets
export const filterPresets = pgTable('filter_presets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  conditions: jsonb('conditions').notNull(),
  sortBy: text('sort_by'),
  sortOrder: text('sort_order'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Audit logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: text('action').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Types for inserts
export type NewTicker = typeof tickers.$inferInsert;
export type Ticker = typeof tickers.$inferSelect;

export type NewIndicatorSnapshot = typeof indicatorSnapshots.$inferInsert;
export type IndicatorSnapshot = typeof indicatorSnapshots.$inferSelect;

export type NewFilterPreset = typeof filterPresets.$inferInsert;
export type FilterPreset = typeof filterPresets.$inferSelect;
