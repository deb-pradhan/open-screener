CREATE TABLE IF NOT EXISTS "analyst_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"period" text NOT NULL,
	"strong_buy" integer DEFAULT 0,
	"buy" integer DEFAULT 0,
	"hold" integer DEFAULT 0,
	"sell" integer DEFAULT 0,
	"strong_sell" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_details" (
	"symbol" text PRIMARY KEY NOT NULL,
	"description" text,
	"homepage_url" text,
	"phone_number" text,
	"address" jsonb,
	"sic_code" text,
	"sic_description" text,
	"industry" text,
	"industry_key" text,
	"sector" text,
	"sector_key" text,
	"total_employees" integer,
	"list_date" date,
	"delist_date" date,
	"market_cap" real,
	"shares_outstanding" real,
	"company_officers" jsonb,
	"audit_risk" integer,
	"board_risk" integer,
	"compensation_risk" integer,
	"shareholder_rights_risk" integer,
	"overall_risk" integer,
	"last_synced_at" timestamp,
	"yahoo_synced_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_indicators" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"rsi14" real,
	"sma20" real,
	"sma50" real,
	"sma200" real,
	"ema12" real,
	"ema26" real,
	"macd_value" real,
	"macd_signal" real,
	"macd_histogram" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"open" real NOT NULL,
	"high" real NOT NULL,
	"low" real NOT NULL,
	"close" real NOT NULL,
	"volume" real NOT NULL,
	"vwap" real,
	"change_percent" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dividends" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"ex_dividend_date" date NOT NULL,
	"pay_date" date,
	"record_date" date,
	"declaration_date" date,
	"amount" real NOT NULL,
	"frequency" integer,
	"dividend_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "earnings_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"quarter" text NOT NULL,
	"eps_actual" real,
	"eps_estimate" real,
	"eps_difference" real,
	"surprise_percent" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "filter_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"conditions" jsonb NOT NULL,
	"sort_by" text,
	"sort_order" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_ratios" (
	"symbol" text PRIMARY KEY NOT NULL,
	"pe_ratio" real,
	"forward_pe" real,
	"pb_ratio" real,
	"ps_ratio" real,
	"ev_to_ebitda" real,
	"ev_to_revenue" real,
	"peg_ratio" real,
	"gross_margin" real,
	"operating_margin" real,
	"ebitda_margin" real,
	"net_margin" real,
	"roe" real,
	"roa" real,
	"roic" real,
	"current_ratio" real,
	"quick_ratio" real,
	"debt_to_equity" real,
	"interest_coverage" real,
	"revenue_growth" real,
	"earnings_growth" real,
	"revenue_growth_quarterly" real,
	"earnings_growth_quarterly" real,
	"free_cash_flow" real,
	"operating_cash_flow" real,
	"target_high_price" real,
	"target_low_price" real,
	"target_mean_price" real,
	"target_median_price" real,
	"number_of_analysts" integer,
	"recommendation_key" text,
	"recommendation_mean" real,
	"last_synced_at" timestamp,
	"yahoo_synced_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"statement_type" text NOT NULL,
	"timeframe" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_quarter" integer,
	"period_end" date NOT NULL,
	"filing_date" date,
	"accepted_date" timestamp,
	"raw_data" jsonb NOT NULL,
	"revenue" real,
	"net_income" real,
	"eps" real,
	"total_assets" real,
	"total_liabilities" real,
	"operating_cash_flow" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "holders_breakdown" (
	"symbol" text PRIMARY KEY NOT NULL,
	"insiders_percent_held" real,
	"institutions_percent_held" real,
	"institutions_float_percent_held" real,
	"institutions_count" integer,
	"last_synced_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insider_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"filer_name" text NOT NULL,
	"filer_relation" text,
	"transaction_text" text,
	"shares" real NOT NULL,
	"value" real,
	"transaction_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "institutional_holders" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"holder_name" text NOT NULL,
	"shares" real NOT NULL,
	"percent_held" real,
	"value" real,
	"date_reported" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "latest_snapshot" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text,
	"logo_url" text,
	"price" real NOT NULL,
	"open" real,
	"high" real,
	"low" real,
	"volume" real NOT NULL,
	"vwap" real,
	"change_percent" real,
	"fifty_two_week_high" real,
	"fifty_two_week_low" real,
	"fifty_day_average" real,
	"two_hundred_day_average" real,
	"average_volume" real,
	"beta" real,
	"rsi14" real,
	"sma20" real,
	"sma50" real,
	"sma200" real,
	"ema12" real,
	"ema26" real,
	"macd_value" real,
	"macd_signal" real,
	"macd_histogram" real,
	"market_cap" real,
	"pe_ratio" real,
	"forward_pe" real,
	"pb_ratio" real,
	"ps_ratio" real,
	"peg_ratio" real,
	"ev_to_ebitda" real,
	"ev_to_revenue" real,
	"gross_margin" real,
	"operating_margin" real,
	"ebitda_margin" real,
	"net_margin" real,
	"roe" real,
	"roa" real,
	"revenue_growth_yoy" real,
	"revenue_growth_quarterly" real,
	"eps_growth_yoy" real,
	"earnings_growth_quarterly" real,
	"debt_to_equity" real,
	"current_ratio" real,
	"quick_ratio" real,
	"dividend_yield" real,
	"short_ratio" real,
	"short_percent_of_float" real,
	"target_mean_price" real,
	"target_high_price" real,
	"target_low_price" real,
	"number_of_analysts" integer,
	"recommendation_mean" real,
	"insiders_percent_held" real,
	"institutions_percent_held" real,
	"financials_last_sync" timestamp,
	"ratios_last_sync" timestamp,
	"yahoo_synced_at" timestamp,
	"data_date" date NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"published_at" timestamp NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"article_url" text,
	"image_url" text,
	"description" text,
	"keywords" jsonb,
	"publisher" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_tickers" (
	"article_id" text NOT NULL,
	"symbol" text NOT NULL,
	CONSTRAINT "news_tickers_article_id_symbol_pk" PRIMARY KEY("article_id","symbol")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"execution_date" date NOT NULL,
	"split_from" real NOT NULL,
	"split_to" real NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_checkpoints" (
	"sync_type" text PRIMARY KEY NOT NULL,
	"last_symbol" text NOT NULL,
	"processed_count" integer DEFAULT 0,
	"total_count" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_locks" (
	"lock_name" text PRIMARY KEY NOT NULL,
	"locked_by" text NOT NULL,
	"locked_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"tickers_processed" integer DEFAULT 0,
	"tickers_failed" integer DEFAULT 0,
	"error_message" text,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"data_type" text NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_status" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickers" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"market" text NOT NULL,
	"locale" text NOT NULL,
	"primary_exchange" text,
	"type" text,
	"active" boolean DEFAULT true,
	"currency_name" text,
	"cik" text,
	"composite_figi" text,
	"sector" text,
	"industry" text,
	"logo_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upgrade_downgrades" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"grade_date" timestamp NOT NULL,
	"firm" text NOT NULL,
	"to_grade" text NOT NULL,
	"from_grade" text,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "yahoo_sync_cache" (
	"symbol" text PRIMARY KEY NOT NULL,
	"quote_synced_at" timestamp,
	"profile_synced_at" timestamp,
	"stats_synced_at" timestamp,
	"earnings_synced_at" timestamp,
	"analysts_synced_at" timestamp,
	"holders_synced_at" timestamp,
	"full_data_synced_at" timestamp,
	"last_error" text,
	"error_count" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analyst_recommendations" ADD CONSTRAINT "analyst_recommendations_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_details" ADD CONSTRAINT "company_details_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_indicators" ADD CONSTRAINT "daily_indicators_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dividends" ADD CONSTRAINT "dividends_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "earnings_history" ADD CONSTRAINT "earnings_history_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_ratios" ADD CONSTRAINT "financial_ratios_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "holders_breakdown" ADD CONSTRAINT "holders_breakdown_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insider_transactions" ADD CONSTRAINT "insider_transactions_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "institutional_holders" ADD CONSTRAINT "institutional_holders_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "latest_snapshot" ADD CONSTRAINT "latest_snapshot_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "news_tickers" ADD CONSTRAINT "news_tickers_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "news_tickers" ADD CONSTRAINT "news_tickers_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_splits" ADD CONSTRAINT "stock_splits_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upgrade_downgrades" ADD CONSTRAINT "upgrade_downgrades_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "yahoo_sync_cache" ADD CONSTRAINT "yahoo_sync_cache_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "analyst_rec_symbol_period_idx" ON "analyst_recommendations" ("symbol","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analyst_rec_symbol_idx" ON "analyst_recommendations" ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_indicators_symbol_date_idx" ON "daily_indicators" ("symbol","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_indicators_date_idx" ON "daily_indicators" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_indicators_symbol_idx" ON "daily_indicators" ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_prices_symbol_date_idx" ON "daily_prices" ("symbol","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_prices_date_idx" ON "daily_prices" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_prices_symbol_idx" ON "daily_prices" ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "div_symbol_date_idx" ON "dividends" ("symbol","ex_dividend_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "div_ex_date_idx" ON "dividends" ("ex_dividend_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "div_symbol_idx" ON "dividends" ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "earnings_history_symbol_quarter_idx" ON "earnings_history" ("symbol","quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earnings_history_symbol_idx" ON "earnings_history" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ratios_pe_idx" ON "financial_ratios" ("pe_ratio");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ratios_margin_idx" ON "financial_ratios" ("gross_margin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ratios_target_idx" ON "financial_ratios" ("target_mean_price");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fin_stmt_unique_idx" ON "financial_statements" ("symbol","statement_type","timeframe","period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fin_stmt_symbol_idx" ON "financial_statements" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fin_stmt_period_idx" ON "financial_statements" ("period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fin_stmt_type_idx" ON "financial_statements" ("statement_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insider_tx_symbol_date_idx" ON "insider_transactions" ("symbol","transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insider_tx_symbol_idx" ON "insider_transactions" ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inst_holder_symbol_holder_idx" ON "institutional_holders" ("symbol","holder_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inst_holder_symbol_idx" ON "institutional_holders" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_price_idx" ON "latest_snapshot" ("price");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_volume_idx" ON "latest_snapshot" ("volume");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_rsi_idx" ON "latest_snapshot" ("rsi14");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_change_idx" ON "latest_snapshot" ("change_percent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_sma200_idx" ON "latest_snapshot" ("sma200");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_mcap_idx" ON "latest_snapshot" ("market_cap");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_pe_idx" ON "latest_snapshot" ("pe_ratio");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_div_yield_idx" ON "latest_snapshot" ("dividend_yield");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_gross_margin_idx" ON "latest_snapshot" ("gross_margin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_roe_idx" ON "latest_snapshot" ("roe");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_beta_idx" ON "latest_snapshot" ("beta");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_analyst_idx" ON "latest_snapshot" ("recommendation_mean");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "latest_snapshot_short_idx" ON "latest_snapshot" ("short_percent_of_float");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_published_idx" ON "news_articles" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_tickers_symbol_idx" ON "news_tickers" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_tickers_article_idx" ON "news_tickers" ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "split_symbol_date_idx" ON "stock_splits" ("symbol","execution_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "split_symbol_idx" ON "stock_splits" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_locks_expires_idx" ON "sync_locks" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_log_status_idx" ON "sync_log" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_log_type_idx" ON "sync_log" ("sync_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sync_status_symbol_type_idx" ON "sync_status" ("symbol","data_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_status_retry_idx" ON "sync_status" ("next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_status_status_idx" ON "sync_status" ("last_sync_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upgrade_downgrade_symbol_date_idx" ON "upgrade_downgrades" ("symbol","grade_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upgrade_downgrade_symbol_idx" ON "upgrade_downgrades" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upgrade_downgrade_date_idx" ON "upgrade_downgrades" ("grade_date");