import { pgTable, text, timestamp, boolean, real, integer, jsonb, uuid, date, serial, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

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
  // Trading data (from Yahoo)
  fiftyTwoWeekHigh: real('fifty_two_week_high'),
  fiftyTwoWeekLow: real('fifty_two_week_low'),
  fiftyDayAverage: real('fifty_day_average'),
  twoHundredDayAverage: real('two_hundred_day_average'),
  averageVolume: real('average_volume'),
  beta: real('beta'),
  // Technical Indicators
  rsi14: real('rsi14'),
  sma20: real('sma20'),
  sma50: real('sma50'),
  sma200: real('sma200'),
  ema12: real('ema12'),
  ema26: real('ema26'),
  macdValue: real('macd_value'),
  macdSignal: real('macd_signal'),
  macdHistogram: real('macd_histogram'),
  // Valuation (denormalized for screener queries)
  marketCap: real('market_cap'),
  peRatio: real('pe_ratio'),
  forwardPe: real('forward_pe'),
  pbRatio: real('pb_ratio'),
  psRatio: real('ps_ratio'),
  pegRatio: real('peg_ratio'),
  evToEbitda: real('ev_to_ebitda'),
  evToRevenue: real('ev_to_revenue'),
  // Profitability
  grossMargin: real('gross_margin'),
  operatingMargin: real('operating_margin'),
  ebitdaMargin: real('ebitda_margin'),
  netMargin: real('net_margin'),
  roe: real('roe'),
  roa: real('roa'),
  // Growth
  revenueGrowthYoy: real('revenue_growth_yoy'),
  revenueGrowthQuarterly: real('revenue_growth_quarterly'),
  epsGrowthYoy: real('eps_growth_yoy'),
  earningsGrowthQuarterly: real('earnings_growth_quarterly'),
  // Financial health
  debtToEquity: real('debt_to_equity'),
  currentRatio: real('current_ratio'),
  quickRatio: real('quick_ratio'),
  // Dividends
  dividendYield: real('dividend_yield'),
  // Short interest
  shortRatio: real('short_ratio'),
  shortPercentOfFloat: real('short_percent_of_float'),
  // Analyst data
  targetMeanPrice: real('target_mean_price'),
  targetHighPrice: real('target_high_price'),
  targetLowPrice: real('target_low_price'),
  numberOfAnalysts: integer('number_of_analysts'),
  recommendationMean: real('recommendation_mean'),
  // Ownership
  insidersPercentHeld: real('insiders_percent_held'),
  institutionsPercentHeld: real('institutions_percent_held'),
  // Data freshness tracking
  financialsLastSync: timestamp('financials_last_sync'),
  ratiosLastSync: timestamp('ratios_last_sync'),
  yahooSyncedAt: timestamp('yahoo_synced_at'),
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
  // Fundamental screener indexes
  marketCapIdx: index('latest_snapshot_mcap_idx').on(table.marketCap),
  peRatioIdx: index('latest_snapshot_pe_idx').on(table.peRatio),
  divYieldIdx: index('latest_snapshot_div_yield_idx').on(table.dividendYield),
  grossMarginIdx: index('latest_snapshot_gross_margin_idx').on(table.grossMargin),
  // New Yahoo data indexes
  roeIdx: index('latest_snapshot_roe_idx').on(table.roe),
  betaIdx: index('latest_snapshot_beta_idx').on(table.beta),
  analystIdx: index('latest_snapshot_analyst_idx').on(table.recommendationMean),
  shortIdx: index('latest_snapshot_short_idx').on(table.shortPercentOfFloat),
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
// Company Details - Extended ticker info
// ============================================
export const companyDetails = pgTable('company_details', {
  symbol: text('symbol').primaryKey().references(() => tickers.symbol, { onDelete: 'cascade' }),
  description: text('description'),
  homepageUrl: text('homepage_url'),
  phoneNumber: text('phone_number'),
  address: jsonb('address'), // { address1, city, state, postalCode, country }
  sicCode: text('sic_code'),
  sicDescription: text('sic_description'),
  // Industry/Sector from Yahoo
  industry: text('industry'),
  industryKey: text('industry_key'),
  sector: text('sector'),
  sectorKey: text('sector_key'),
  totalEmployees: integer('total_employees'),
  listDate: date('list_date'),
  delistDate: date('delist_date'),
  marketCap: real('market_cap'),
  sharesOutstanding: real('shares_outstanding'),
  // Company officers (JSONB array)
  companyOfficers: jsonb('company_officers'), // Array of { name, title, age, totalPay }
  // Risk scores (1-10 scale, lower is better)
  auditRisk: integer('audit_risk'),
  boardRisk: integer('board_risk'),
  compensationRisk: integer('compensation_risk'),
  shareholderRightsRisk: integer('shareholder_rights_risk'),
  overallRisk: integer('overall_risk'),
  // Sync tracking
  lastSyncedAt: timestamp('last_synced_at'),
  yahooSyncedAt: timestamp('yahoo_synced_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Financial Statements - JSONB + extracted fields
// Stores income statements, balance sheets, cash flow statements
// ============================================
export const financialStatements = pgTable('financial_statements', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  statementType: text('statement_type').notNull(), // 'income' | 'balance' | 'cashflow'
  timeframe: text('timeframe').notNull(), // 'quarterly' | 'annual' | 'ttm'
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalQuarter: integer('fiscal_quarter'), // null for annual
  periodEnd: date('period_end').notNull(),
  filingDate: date('filing_date'),
  acceptedDate: timestamp('accepted_date'),
  // Raw JSONB for all fields (forward-compatible with Polygon schema changes)
  rawData: jsonb('raw_data').notNull(),
  // Extracted fields for common queries
  revenue: real('revenue'),
  netIncome: real('net_income'),
  eps: real('eps'),
  totalAssets: real('total_assets'),
  totalLiabilities: real('total_liabilities'),
  operatingCashFlow: real('operating_cash_flow'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Composite unique constraint - one statement per symbol/type/period
  uniqueStatement: uniqueIndex('fin_stmt_unique_idx')
    .on(table.symbol, table.statementType, table.timeframe, table.periodEnd),
  symbolIdx: index('fin_stmt_symbol_idx').on(table.symbol),
  periodIdx: index('fin_stmt_period_idx').on(table.periodEnd),
  typeIdx: index('fin_stmt_type_idx').on(table.statementType),
}));

// ============================================
// Financial Ratios - Latest TTM-based ratios
// ============================================
export const financialRatios = pgTable('financial_ratios', {
  symbol: text('symbol').primaryKey().references(() => tickers.symbol, { onDelete: 'cascade' }),
  // Valuation
  peRatio: real('pe_ratio'),
  forwardPe: real('forward_pe'),
  pbRatio: real('pb_ratio'),
  psRatio: real('ps_ratio'),
  evToEbitda: real('ev_to_ebitda'),
  evToRevenue: real('ev_to_revenue'),
  pegRatio: real('peg_ratio'),
  // Profitability
  grossMargin: real('gross_margin'),
  operatingMargin: real('operating_margin'),
  ebitdaMargin: real('ebitda_margin'),
  netMargin: real('net_margin'),
  roe: real('roe'),
  roa: real('roa'),
  roic: real('roic'),
  // Liquidity
  currentRatio: real('current_ratio'),
  quickRatio: real('quick_ratio'),
  // Leverage
  debtToEquity: real('debt_to_equity'),
  interestCoverage: real('interest_coverage'),
  // Growth rates (percentage)
  revenueGrowth: real('revenue_growth'),
  earningsGrowth: real('earnings_growth'),
  revenueGrowthQuarterly: real('revenue_growth_quarterly'),
  earningsGrowthQuarterly: real('earnings_growth_quarterly'),
  // Cash Flow
  freeCashFlow: real('free_cash_flow'),
  operatingCashFlow: real('operating_cash_flow'),
  // Analyst Targets
  targetHighPrice: real('target_high_price'),
  targetLowPrice: real('target_low_price'),
  targetMeanPrice: real('target_mean_price'),
  targetMedianPrice: real('target_median_price'),
  numberOfAnalysts: integer('number_of_analysts'),
  recommendationKey: text('recommendation_key'), // 'buy', 'hold', 'sell', etc.
  recommendationMean: real('recommendation_mean'), // 1-5 scale
  // Metadata
  lastSyncedAt: timestamp('last_synced_at'),
  yahooSyncedAt: timestamp('yahoo_synced_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  peIdx: index('ratios_pe_idx').on(table.peRatio),
  marginIdx: index('ratios_margin_idx').on(table.grossMargin),
  targetIdx: index('ratios_target_idx').on(table.targetMeanPrice),
}));

// ============================================
// Dividends
// ============================================
export const dividends = pgTable('dividends', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  exDividendDate: date('ex_dividend_date').notNull(),
  payDate: date('pay_date'),
  recordDate: date('record_date'),
  declarationDate: date('declaration_date'),
  amount: real('amount').notNull(),
  frequency: integer('frequency'), // 1=annual, 2=semi, 4=quarterly, 12=monthly
  dividendType: text('dividend_type'), // 'CD' (cash), 'SC' (special cash), etc.
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolDateIdx: uniqueIndex('div_symbol_date_idx').on(table.symbol, table.exDividendDate),
  exDateIdx: index('div_ex_date_idx').on(table.exDividendDate),
  symbolIdx: index('div_symbol_idx').on(table.symbol),
}));

// ============================================
// Stock Splits
// ============================================
export const stockSplits = pgTable('stock_splits', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  executionDate: date('execution_date').notNull(),
  splitFrom: real('split_from').notNull(), // e.g., 1
  splitTo: real('split_to').notNull(),     // e.g., 4 (for 4:1 split)
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolDateIdx: uniqueIndex('split_symbol_date_idx').on(table.symbol, table.executionDate),
  symbolIdx: index('split_symbol_idx').on(table.symbol),
}));

// ============================================
// News Articles
// ============================================
export const newsArticles = pgTable('news_articles', {
  id: text('id').primaryKey(), // Polygon article ID
  publishedAt: timestamp('published_at').notNull(),
  title: text('title').notNull(),
  author: text('author'),
  articleUrl: text('article_url'),
  imageUrl: text('image_url'),
  description: text('description'),
  keywords: jsonb('keywords'), // string[]
  publisher: jsonb('publisher'), // { name, homepage_url, logo_url }
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  publishedIdx: index('news_published_idx').on(table.publishedAt),
}));

// ============================================
// News Tickers - Junction table (many-to-many)
// One article can mention multiple tickers
// ============================================
export const newsTickers = pgTable('news_tickers', {
  articleId: text('article_id').notNull().references(() => newsArticles.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.articleId, table.symbol] }),
  symbolIdx: index('news_tickers_symbol_idx').on(table.symbol),
  articleIdx: index('news_tickers_article_idx').on(table.articleId),
}));

// ============================================
// Earnings History - Historical EPS data from Yahoo
// ============================================
export const earningsHistory = pgTable('earnings_history', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  quarter: text('quarter').notNull(), // e.g., 'Q4 2024'
  epsActual: real('eps_actual'),
  epsEstimate: real('eps_estimate'),
  epsDifference: real('eps_difference'),
  surprisePercent: real('surprise_percent'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolQuarterIdx: uniqueIndex('earnings_history_symbol_quarter_idx').on(table.symbol, table.quarter),
  symbolIdx: index('earnings_history_symbol_idx').on(table.symbol),
}));

// ============================================
// Analyst Recommendations - Buy/Hold/Sell breakdown
// ============================================
export const analystRecommendations = pgTable('analyst_recommendations', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  period: text('period').notNull(), // e.g., '0m', '-1m', '-2m', '-3m'
  strongBuy: integer('strong_buy').default(0),
  buy: integer('buy').default(0),
  hold: integer('hold').default(0),
  sell: integer('sell').default(0),
  strongSell: integer('strong_sell').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  symbolPeriodIdx: uniqueIndex('analyst_rec_symbol_period_idx').on(table.symbol, table.period),
  symbolIdx: index('analyst_rec_symbol_idx').on(table.symbol),
}));

// ============================================
// Upgrade/Downgrades - Analyst rating changes
// ============================================
export const upgradeDowngrades = pgTable('upgrade_downgrades', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  gradeDate: timestamp('grade_date').notNull(),
  firm: text('firm').notNull(),
  toGrade: text('to_grade').notNull(),
  fromGrade: text('from_grade'),
  action: text('action').notNull(), // 'up', 'down', 'main', 'init', 'reit'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolDateIdx: index('upgrade_downgrade_symbol_date_idx').on(table.symbol, table.gradeDate),
  symbolIdx: index('upgrade_downgrade_symbol_idx').on(table.symbol),
  dateIdx: index('upgrade_downgrade_date_idx').on(table.gradeDate),
}));

// ============================================
// Holders Breakdown - Insider/Institution ownership percentages
// ============================================
export const holdersBreakdown = pgTable('holders_breakdown', {
  symbol: text('symbol').primaryKey().references(() => tickers.symbol, { onDelete: 'cascade' }),
  insidersPercentHeld: real('insiders_percent_held'),
  institutionsPercentHeld: real('institutions_percent_held'),
  institutionsFloatPercentHeld: real('institutions_float_percent_held'),
  institutionsCount: integer('institutions_count'),
  lastSyncedAt: timestamp('last_synced_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Institutional Holders - Top institutional holders
// ============================================
export const institutionalHolders = pgTable('institutional_holders', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  holderName: text('holder_name').notNull(),
  shares: real('shares').notNull(),
  percentHeld: real('percent_held'),
  value: real('value'),
  dateReported: date('date_reported'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolHolderIdx: uniqueIndex('inst_holder_symbol_holder_idx').on(table.symbol, table.holderName),
  symbolIdx: index('inst_holder_symbol_idx').on(table.symbol),
}));

// ============================================
// Insider Transactions - Recent insider trades
// ============================================
export const insiderTransactions = pgTable('insider_transactions', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().references(() => tickers.symbol, { onDelete: 'cascade' }),
  filerName: text('filer_name').notNull(),
  filerRelation: text('filer_relation'),
  transactionText: text('transaction_text'),
  shares: real('shares').notNull(),
  value: real('value'),
  transactionDate: date('transaction_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolDateIdx: index('insider_tx_symbol_date_idx').on(table.symbol, table.transactionDate),
  symbolIdx: index('insider_tx_symbol_idx').on(table.symbol),
}));

// ============================================
// Yahoo Sync Cache - Track when Yahoo data was last synced per symbol
// ============================================
export const yahooSyncCache = pgTable('yahoo_sync_cache', {
  symbol: text('symbol').primaryKey().references(() => tickers.symbol, { onDelete: 'cascade' }),
  // Track individual data types
  quoteSyncedAt: timestamp('quote_synced_at'),
  profileSyncedAt: timestamp('profile_synced_at'),
  statsSyncedAt: timestamp('stats_synced_at'),
  earningsSyncedAt: timestamp('earnings_synced_at'),
  analystsSyncedAt: timestamp('analysts_synced_at'),
  holdersSyncedAt: timestamp('holders_synced_at'),
  // Full data bundle
  fullDataSyncedAt: timestamp('full_data_synced_at'),
  // Error tracking
  lastError: text('last_error'),
  errorCount: integer('error_count').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Sync Status - Per-symbol sync tracking for resumable operations
// ============================================
export const syncStatus = pgTable('sync_status', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  dataType: text('data_type').notNull(), // 'financials' | 'dividends' | 'splits' | 'details' | 'ratios' | 'news'
  lastSyncedAt: timestamp('last_synced_at'),
  lastSyncStatus: text('last_sync_status'), // 'success' | 'failed' | 'partial'
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  symbolTypeIdx: uniqueIndex('sync_status_symbol_type_idx').on(table.symbol, table.dataType),
  retryIdx: index('sync_status_retry_idx').on(table.nextRetryAt),
  statusIdx: index('sync_status_status_idx').on(table.lastSyncStatus),
}));

// ============================================
// Sync Locks - Distributed locking for sync operations
// Prevents concurrent syncs across multiple instances
// ============================================
export const syncLocks = pgTable('sync_locks', {
  lockName: text('lock_name').primaryKey(),
  lockedBy: text('locked_by').notNull(), // instance ID
  lockedAt: timestamp('locked_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  expiresIdx: index('sync_locks_expires_idx').on(table.expiresAt),
}));

// ============================================
// Sync Checkpoints - For resumable operations
// ============================================
export const syncCheckpoints = pgTable('sync_checkpoints', {
  syncType: text('sync_type').primaryKey(), // 'financials' | 'dividends' | etc.
  lastSymbol: text('last_symbol').notNull(),
  processedCount: integer('processed_count').default(0),
  totalCount: integer('total_count'),
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

export type NewCompanyDetails = typeof companyDetails.$inferInsert;
export type CompanyDetails = typeof companyDetails.$inferSelect;

export type NewFinancialStatement = typeof financialStatements.$inferInsert;
export type FinancialStatement = typeof financialStatements.$inferSelect;

export type NewFinancialRatios = typeof financialRatios.$inferInsert;
export type FinancialRatios = typeof financialRatios.$inferSelect;

export type NewDividend = typeof dividends.$inferInsert;
export type Dividend = typeof dividends.$inferSelect;

export type NewStockSplit = typeof stockSplits.$inferInsert;
export type StockSplit = typeof stockSplits.$inferSelect;

export type NewNewsArticle = typeof newsArticles.$inferInsert;
export type NewsArticle = typeof newsArticles.$inferSelect;

export type NewNewsTicker = typeof newsTickers.$inferInsert;
export type NewsTicker = typeof newsTickers.$inferSelect;

export type NewSyncStatus = typeof syncStatus.$inferInsert;
export type SyncStatusRecord = typeof syncStatus.$inferSelect;

export type NewSyncLock = typeof syncLocks.$inferInsert;
export type SyncLock = typeof syncLocks.$inferSelect;

export type NewSyncCheckpoint = typeof syncCheckpoints.$inferInsert;
export type SyncCheckpoint = typeof syncCheckpoints.$inferSelect;

export type NewEarningsHistory = typeof earningsHistory.$inferInsert;
export type EarningsHistoryRecord = typeof earningsHistory.$inferSelect;

export type NewAnalystRecommendation = typeof analystRecommendations.$inferInsert;
export type AnalystRecommendationRecord = typeof analystRecommendations.$inferSelect;

export type NewUpgradeDowngrade = typeof upgradeDowngrades.$inferInsert;
export type UpgradeDowngradeRecord = typeof upgradeDowngrades.$inferSelect;

export type NewHoldersBreakdown = typeof holdersBreakdown.$inferInsert;
export type HoldersBreakdownRecord = typeof holdersBreakdown.$inferSelect;

export type NewInstitutionalHolder = typeof institutionalHolders.$inferInsert;
export type InstitutionalHolderRecord = typeof institutionalHolders.$inferSelect;

export type NewInsiderTransaction = typeof insiderTransactions.$inferInsert;
export type InsiderTransactionRecord = typeof insiderTransactions.$inferSelect;

export type NewYahooSyncCache = typeof yahooSyncCache.$inferInsert;
export type YahooSyncCacheRecord = typeof yahooSyncCache.$inferSelect;
