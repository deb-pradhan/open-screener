import { db, isDbConnected } from '../db';
import { latestSnapshot } from '../db/schema';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dataSyncService } from './data-sync';
import path from 'path';

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
   * Run Drizzle migrations automatically
   * This handles schema changes on every deployment
   */
  private async runMigrations(): Promise<void> {
    console.log('📋 Running database migrations...');
    
    try {
      // Determine migrations folder path
      // In production (Docker), we're at /app/apps/api
      // In development, we're at the project root
      const migrationsFolder = process.env.NODE_ENV === 'production'
        ? '/app/apps/api/drizzle'
        : path.join(process.cwd(), 'drizzle');
      
      console.log(`📁 Migrations folder: ${migrationsFolder}`);
      
      await migrate(db, { migrationsFolder });
      console.log('✅ Database migrations complete');
    } catch (error: any) {
      // If migrations folder doesn't exist or no migrations, that's okay
      if (error.code === 'ENOENT') {
        console.log('⚠️  No migrations folder found - using existing schema');
        return;
      }
      // If already up to date, no error
      if (error.message?.includes('already been applied')) {
        console.log('✅ Database already up to date');
        return;
      }
      throw error;
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
