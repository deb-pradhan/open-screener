import { db, checkDbConnection } from '../db';
import { latestSnapshot } from '../db/schema';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dataSyncService } from './data-sync';
import path from 'path';
import fs from 'fs';

/**
 * Startup service - handles automatic database setup and initial data sync
 */
export class StartupService {
  
  /**
   * Run all startup tasks
   */
  async initialize(): Promise<void> {
    console.log('🚀 Running startup initialization...');
    
    // Wait for database connection (with timeout)
    const connected = await this.waitForConnection(10000);
    if (!connected) {
      console.log('⚠️  Database not connected after timeout - skipping initialization');
      return;
    }

    try {
      // Step 1: Run migrations (creates/updates tables automatically)
      await this.runMigrations();
      
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
   * Wait for database connection with timeout
   */
  private async waitForConnection(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const connected = await checkDbConnection();
      if (connected) {
        console.log('✅ Database connection established');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  /**
   * Run Drizzle migrations automatically
   * This handles schema changes on every deployment
   */
  private async runMigrations(): Promise<void> {
    console.log('📋 Running database migrations...');
    
    try {
      // Pre-migration: ensure data integrity for foreign key constraints
      await this.ensureDataIntegrity();
      
      // Determine migrations folder path
      // In production (Docker), we're at /app/apps/api
      // In development, we're at the project root
      const cwd = process.cwd();
      console.log(`📁 Current working directory: ${cwd}`);
      
      // Try multiple possible paths
      const possiblePaths = [
        path.join(cwd, 'drizzle'),                    // ./drizzle (from apps/api)
        '/app/apps/api/drizzle',                       // Docker absolute path
        path.join(cwd, 'apps/api/drizzle'),           // From project root
        path.join(__dirname, '../../drizzle'),        // Relative to this file
      ];
      
      let migrationsFolder: string | null = null;
      for (const p of possiblePaths) {
        console.log(`📁 Checking path: ${p}`);
        if (fs.existsSync(p)) {
          migrationsFolder = p;
          console.log(`✅ Found migrations at: ${p}`);
          break;
        }
      }
      
      if (!migrationsFolder) {
        console.log('⚠️  No migrations folder found at any of:', possiblePaths);
        console.log('⚠️  Skipping migrations - database schema must already exist');
        return;
      }
      
      // List migration files for debugging
      const files = fs.readdirSync(migrationsFolder);
      console.log(`📁 Migration files found: ${files.join(', ')}`);
      
      await migrate(db, { migrationsFolder });
      console.log('✅ Database migrations complete');
    } catch (error: any) {
      console.error('❌ Migration error:', error.message || error);
      // If already up to date, no error
      if (error.message?.includes('already been applied')) {
        console.log('✅ Database already up to date');
        return;
      }
      throw error;
    }
  }

  /**
   * Ensure data integrity before running migrations
   * This handles orphan records that would violate foreign key constraints
   */
  private async ensureDataIntegrity(): Promise<void> {
    console.log('🔧 Ensuring data integrity before migrations...');
    
    try {
      // Check if latest_snapshot exists and has data
      const snapshotExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'latest_snapshot'
        ) as exists
      `);
      
      if (!snapshotExists[0]?.exists) {
        console.log('📊 No existing latest_snapshot table - skipping integrity check');
        return;
      }

      // Check if tickers table exists
      const tickersExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'tickers'
        ) as exists
      `);

      if (!tickersExists[0]?.exists) {
        console.log('📊 No existing tickers table - skipping integrity check');
        return;
      }

      // Insert missing tickers from latest_snapshot
      // This ensures foreign key constraints can be added
      const result = await db.execute(sql`
        INSERT INTO tickers (symbol, name, market, locale)
        SELECT DISTINCT 
          ls.symbol,
          COALESCE(ls.name, ls.symbol) as name,
          'stocks' as market,
          'us' as locale
        FROM latest_snapshot ls
        LEFT JOIN tickers t ON t.symbol = ls.symbol
        WHERE t.symbol IS NULL
        ON CONFLICT (symbol) DO NOTHING
      `);
      
      console.log('✅ Data integrity ensured - orphan records handled');
    } catch (error: any) {
      // If tables don't exist yet, that's fine
      if (error.code === '42P01') {
        console.log('📊 Tables do not exist yet - skipping integrity check');
        return;
      }
      console.warn('⚠️  Data integrity check failed (non-fatal):', error.message);
    }
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
   * Check if indicators are populated
   */
  private async hasIndicatorData(): Promise<boolean> {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(latestSnapshot)
        .where(sql`${latestSnapshot.sma200} IS NOT NULL`);
      
      const count = Number(result?.count || 0);
      console.log(`📊 Stocks with indicator data: ${count}`);
      
      // Consider indicators populated if at least 100 stocks have SMA200
      return count >= 100;
    } catch {
      return false;
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
      
      // Check if we need indicator data
      const hasIndicators = await this.hasIndicatorData();
      if (!hasIndicators) {
        console.log('📊 No indicator data found - triggering indicator sync in background...');
        // Run daily sync in background (don't await - it takes a while)
        this.syncIndicatorsInBackground();
      }
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync indicators in background (non-blocking)
   */
  private async syncIndicatorsInBackground(): Promise<void> {
    try {
      console.log('🔄 Background indicator sync starting...');
      const result = await dataSyncService.syncDailyData();
      console.log(`✅ Background indicator sync complete: ${result.processed} stocks with indicators`);
      
      // Also sync logos after indicators
      await this.syncLogosInBackground();
    } catch (error) {
      console.error('❌ Background indicator sync failed:', error);
    }
  }

  /**
   * Sync logos in background (non-blocking)
   */
  private async syncLogosInBackground(): Promise<void> {
    try {
      console.log('🖼️ Background logo sync starting...');
      const result = await dataSyncService.syncMissingLogos(1000);
      console.log(`✅ Background logo sync complete: ${result.processed} logos fetched`);
    } catch (error) {
      console.error('❌ Background logo sync failed:', error);
    }
  }
}

// Singleton instance
export const startupService = new StartupService();
