import { db, isDbConnected } from '../db';
import { latestSnapshot, syncLog } from '../db/schema';
import { sql } from 'drizzle-orm';
import { dataSyncService } from './data-sync';

/**
 * Startup service - handles automatic database setup and initial data sync
 */
export class StartupService {
  
  /**
   * Run all startup tasks
   */
  async initialize(): Promise<void> {
    console.log('🚀 Running startup initialization...');
    
    // Skip if no database configured
    if (!isDbConnected()) {
      console.log('⚠️  No database configured - skipping initialization');
      return;
    }

    try {
      // Step 1: Ensure tables exist
      await this.ensureTablesExist();
      
      // Step 2: Check if we need initial data
      const needsSync = await this.needsInitialSync();
      
      if (needsSync) {
        console.log('📊 Database is empty - triggering initial sync...');
        await this.runInitialSync();
      } else {
        console.log('✅ Database has data - skipping initial sync');
      }
      
      console.log('🎉 Startup initialization complete');
    } catch (error) {
      console.error('❌ Startup initialization failed:', error);
      // Don't crash the app - it can still work in API-only mode
    }
  }

  /**
   * Ensure database tables exist (auto-migration)
   */
  private async ensureTablesExist(): Promise<void> {
    console.log('📋 Checking database tables...');
    
    try {
      // Try to query a table - if it fails, tables don't exist
      await db.select({ count: sql<number>`1` }).from(latestSnapshot).limit(1);
      console.log('✅ Database tables exist');
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        console.log('⚠️  Tables do not exist - creating...');
        await this.createTables();
      } else {
        throw error;
      }
    }
  }

  /**
   * Create database tables using raw SQL
   * This is a fallback if drizzle-kit push hasn't been run
   */
  private async createTables(): Promise<void> {
    console.log('🔨 Creating database tables...');
    
    // Create tables in order (respecting foreign keys)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tickers (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        market TEXT NOT NULL,
        locale TEXT NOT NULL,
        primary_exchange TEXT,
        type TEXT,
        active BOOLEAN DEFAULT true,
        currency_name TEXT,
        cik TEXT,
        composite_figi TEXT,
        sector TEXT,
        industry TEXT,
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_prices (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
        date DATE NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        vwap REAL,
        change_percent REAL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(symbol, date)
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS daily_prices_date_idx ON daily_prices(date)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS daily_prices_symbol_idx ON daily_prices(symbol)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_indicators (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
        date DATE NOT NULL,
        rsi14 REAL,
        sma20 REAL,
        sma50 REAL,
        sma200 REAL,
        ema12 REAL,
        ema26 REAL,
        macd_value REAL,
        macd_signal REAL,
        macd_histogram REAL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(symbol, date)
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS daily_indicators_date_idx ON daily_indicators(date)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS latest_snapshot (
        symbol TEXT PRIMARY KEY,
        name TEXT,
        logo_url TEXT,
        price REAL NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        volume REAL NOT NULL,
        vwap REAL,
        change_percent REAL,
        rsi14 REAL,
        sma20 REAL,
        sma50 REAL,
        sma200 REAL,
        ema12 REAL,
        ema26 REAL,
        macd_value REAL,
        macd_signal REAL,
        macd_histogram REAL,
        data_date DATE NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS latest_snapshot_price_idx ON latest_snapshot(price)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS latest_snapshot_volume_idx ON latest_snapshot(volume)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS latest_snapshot_rsi_idx ON latest_snapshot(rsi14)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS latest_snapshot_change_idx ON latest_snapshot(change_percent)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL,
        tickers_processed INTEGER DEFAULT 0,
        tickers_failed INTEGER DEFAULT 0,
        error_message TEXT,
        metadata JSONB,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS filter_presets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        conditions JSONB NOT NULL,
        sort_by TEXT,
        sort_order TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database tables created');
  }

  /**
   * Check if we need to run initial sync
   */
  private async needsInitialSync(): Promise<boolean> {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(latestSnapshot);
      
      const count = Number(result?.count || 0);
      console.log(`📊 Current snapshot count: ${count}`);
      
      // Need sync if less than 100 stocks
      return count < 100;
    } catch {
      return true;
    }
  }

  /**
   * Run initial data sync
   */
  private async runInitialSync(): Promise<void> {
    console.log('🔄 Starting initial data sync (this may take a few minutes)...');
    
    try {
      // First, do a quick snapshot sync to get basic data fast
      const result = await dataSyncService.syncHourlySnapshot();
      console.log(`✅ Initial sync complete: ${result.processed} stocks loaded`);
      
      // Note: Daily sync with indicators will run at scheduled time
      // or can be triggered manually via /api/sync/daily
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      throw error;
    }
  }
}

// Singleton instance
export const startupService = new StartupService();
