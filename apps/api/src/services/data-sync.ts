import { db } from '../db';
import { tickers, dailyPrices, dailyIndicators, latestSnapshot, syncLog } from '../db/schema';
import { MassiveClient } from '../clients/massive';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import type { TickerSnapshot } from '@screener/shared';

export class DataSyncService {
  private massiveClient: MassiveClient;
  private isRunning = false;

  constructor() {
    this.massiveClient = new MassiveClient();
  }

  // ============================================
  // Main sync entry points
  // ============================================

  /**
   * Hourly sync - Update latest snapshot with current prices
   * Run during market hours (9:30 AM - 4 PM ET)
   */
  async syncHourlySnapshot(): Promise<{ processed: number; failed: number }> {
    if (this.isRunning) {
      console.log('Sync already in progress, skipping...');
      return { processed: 0, failed: 0 };
    }

    this.isRunning = true;
    const logId = await this.startSyncLog('snapshot');

    try {
      console.log('Starting hourly snapshot sync...');
      
      // Fetch market snapshot from Polygon
      const snapshots = await this.massiveClient.getMarketSnapshot();
      
      if (!snapshots || snapshots.length === 0) {
        throw new Error('No snapshot data received from API');
      }

      console.log(`Received ${snapshots.length} tickers from API`);

      // Process in batches
      const batchSize = 100;
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < snapshots.length; i += batchSize) {
        const batch = snapshots.slice(i, i + batchSize);
        
        try {
          await this.upsertLatestSnapshots(batch);
          processed += batch.length;
        } catch (error) {
          console.error(`Batch ${i / batchSize} failed:`, error);
          failed += batch.length;
        }

        // Progress log every 500
        if (processed % 500 === 0) {
          console.log(`Progress: ${processed}/${snapshots.length} processed`);
        }
      }

      await this.completeSyncLog(logId, processed, failed);
      console.log(`Hourly sync complete: ${processed} processed, ${failed} failed`);

      return { processed, failed };
    } catch (error) {
      await this.failSyncLog(logId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Daily sync - Full sync with indicators after market close
   * Run at 4:30 PM ET on trading days
   */
  async syncDailyData(): Promise<{ processed: number; failed: number }> {
    if (this.isRunning) {
      console.log('Sync already in progress, skipping...');
      return { processed: 0, failed: 0 };
    }

    this.isRunning = true;
    const logId = await this.startSyncLog('daily');

    try {
      console.log('Starting daily data sync...');
      
      // Get market snapshot
      const snapshots = await this.massiveClient.getMarketSnapshot();
      
      if (!snapshots || snapshots.length === 0) {
        throw new Error('No snapshot data received');
      }

      const today = new Date().toISOString().split('T')[0];
      let processed = 0;
      let failed = 0;

      // Process top stocks by volume (limit API calls)
      const topStocks = snapshots
        .filter(s => s.day?.v && s.day.v > 100000)
        .sort((a, b) => (b.day?.v || 0) - (a.day?.v || 0))
        .slice(0, 1000); // Top 1000 by volume

      console.log(`Processing ${topStocks.length} stocks with volume > 100K`);

      // Process in batches with indicators
      const batchSize = 20;
      
      for (let i = 0; i < topStocks.length; i += batchSize) {
        const batch = topStocks.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(snapshot => this.processStockWithIndicators(snapshot, today))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            processed++;
          } else {
            failed++;
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (processed % 100 === 0) {
          console.log(`Progress: ${processed}/${topStocks.length}`);
        }
      }

      await this.completeSyncLog(logId, processed, failed);
      console.log(`Daily sync complete: ${processed} processed, ${failed} failed`);

      return { processed, failed };
    } catch (error) {
      await this.failSyncLog(logId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Backfill historical data for a symbol
   */
  async backfillSymbol(symbol: string, days: number = 30): Promise<void> {
    console.log(`Backfilling ${days} days for ${symbol}...`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      // Fetch historical bars
      const bars = await this.massiveClient.getAggregates({
        symbol,
        multiplier: 1,
        timespan: 'day',
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      });

      if (!bars || bars.length === 0) {
        console.log(`No historical data for ${symbol}`);
        return;
      }

      // Insert daily prices
      for (const bar of bars) {
        const dateStr = new Date(bar.t).toISOString().split('T')[0];
        
        await db.insert(dailyPrices)
          .values({
            symbol,
            date: dateStr,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
            vwap: bar.vw,
          })
          .onConflictDoUpdate({
            target: [dailyPrices.symbol, dailyPrices.date],
            set: {
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              vwap: bar.vw,
            },
          });
      }

      console.log(`Backfilled ${bars.length} days for ${symbol}`);
    } catch (error) {
      console.error(`Failed to backfill ${symbol}:`, error);
      throw error;
    }
  }

  // ============================================
  // Internal helpers
  // ============================================

  private async processStockWithIndicators(
    snapshot: TickerSnapshot,
    dateStr: string
  ): Promise<void> {
    const symbol = snapshot.ticker;
    const dayData = snapshot.day || snapshot.prevDay;
    
    if (!dayData) return;

    // Upsert daily price
    await db.insert(dailyPrices)
      .values({
        symbol,
        date: dateStr,
        open: dayData.o,
        high: dayData.h,
        low: dayData.l,
        close: dayData.c,
        volume: dayData.v,
        vwap: dayData.vw,
        changePercent: snapshot.todaysChangePerc,
      })
      .onConflictDoUpdate({
        target: [dailyPrices.symbol, dailyPrices.date],
        set: {
          open: dayData.o,
          high: dayData.h,
          low: dayData.l,
          close: dayData.c,
          volume: dayData.v,
          vwap: dayData.vw,
          changePercent: snapshot.todaysChangePerc,
        },
      });

    // Fetch and store indicators
    const [rsi, sma20, sma50, sma200, ema12, ema26] = await Promise.all([
      this.massiveClient.getRSI(symbol, 14).catch(() => null),
      this.massiveClient.getSMA(symbol, 20).catch(() => null),
      this.massiveClient.getSMA(symbol, 50).catch(() => null),
      this.massiveClient.getSMA(symbol, 200).catch(() => null),
      this.massiveClient.getEMA(symbol, 12).catch(() => null),
      this.massiveClient.getEMA(symbol, 26).catch(() => null),
    ]);

    // Upsert indicators
    await db.insert(dailyIndicators)
      .values({
        symbol,
        date: dateStr,
        rsi14: rsi?.value,
        sma20: sma20?.value,
        sma50: sma50?.value,
        sma200: sma200?.value,
        ema12: ema12?.value,
        ema26: ema26?.value,
      })
      .onConflictDoUpdate({
        target: [dailyIndicators.symbol, dailyIndicators.date],
        set: {
          rsi14: rsi?.value,
          sma20: sma20?.value,
          sma50: sma50?.value,
          sma200: sma200?.value,
          ema12: ema12?.value,
          ema26: ema26?.value,
        },
      });

    // Fetch ticker details for logo/name
    const details = await this.massiveClient.getTickerDetails(symbol).catch(() => null);

    // Update latest snapshot (denormalized for fast queries)
    await db.insert(latestSnapshot)
      .values({
        symbol,
        name: details?.name || symbol,
        logoUrl: details?.branding?.logo_url,
        price: dayData.c,
        open: dayData.o,
        high: dayData.h,
        low: dayData.l,
        volume: dayData.v,
        vwap: dayData.vw,
        changePercent: snapshot.todaysChangePerc,
        rsi14: rsi?.value,
        sma20: sma20?.value,
        sma50: sma50?.value,
        sma200: sma200?.value,
        ema12: ema12?.value,
        ema26: ema26?.value,
        dataDate: dateStr,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: latestSnapshot.symbol,
        set: {
          name: details?.name || symbol,
          logoUrl: details?.branding?.logo_url,
          price: dayData.c,
          open: dayData.o,
          high: dayData.h,
          low: dayData.l,
          volume: dayData.v,
          vwap: dayData.vw,
          changePercent: snapshot.todaysChangePerc,
          rsi14: rsi?.value,
          sma20: sma20?.value,
          sma50: sma50?.value,
          sma200: sma200?.value,
          ema12: ema12?.value,
          ema26: ema26?.value,
          dataDate: dateStr,
          updatedAt: new Date(),
        },
      });
  }

  private async upsertLatestSnapshots(snapshots: TickerSnapshot[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const values = snapshots
      .filter(s => s.ticker && (s.day || s.prevDay))
      .map(snapshot => {
        const dayData = snapshot.day?.v ? snapshot.day : snapshot.prevDay;
        if (!dayData) return null;
        
        return {
          symbol: snapshot.ticker,
          price: dayData.c || snapshot.lastTrade?.p || 0,
          volume: dayData.v || 0,
          changePercent: snapshot.todaysChangePerc || 0,
          open: dayData.o,
          high: dayData.h,
          low: dayData.l,
          vwap: dayData.vw,
          dataDate: today,
          updatedAt: new Date(),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null && v.price > 0);

    if (values.length === 0) return;

    // Batch upsert
    for (const value of values) {
      await db.insert(latestSnapshot)
        .values(value)
        .onConflictDoUpdate({
          target: latestSnapshot.symbol,
          set: {
            price: value.price,
            volume: value.volume,
            changePercent: value.changePercent,
            open: value.open,
            high: value.high,
            low: value.low,
            vwap: value.vwap,
            dataDate: value.dataDate,
            updatedAt: value.updatedAt,
          },
        });
    }
  }

  // ============================================
  // Sync logging
  // ============================================

  private async startSyncLog(type: string): Promise<number> {
    const [result] = await db.insert(syncLog)
      .values({
        syncType: type,
        status: 'started',
      })
      .returning({ id: syncLog.id });
    
    return result.id;
  }

  private async completeSyncLog(id: number, processed: number, failed: number): Promise<void> {
    await db.update(syncLog)
      .set({
        status: 'completed',
        tickersProcessed: processed,
        tickersFailed: failed,
        completedAt: new Date(),
      })
      .where(eq(syncLog.id, id));
  }

  private async failSyncLog(id: number, error: string): Promise<void> {
    await db.update(syncLog)
      .set({
        status: 'failed',
        errorMessage: error,
        completedAt: new Date(),
      })
      .where(eq(syncLog.id, id));
  }

  // ============================================
  // Query helpers for screener
  // ============================================

  async getLatestSnapshots(
    limit: number = 500,
    offset: number = 0
  ): Promise<typeof latestSnapshot.$inferSelect[]> {
    return db.select()
      .from(latestSnapshot)
      .orderBy(desc(latestSnapshot.volume))
      .limit(limit)
      .offset(offset);
  }

  async getSnapshotCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(latestSnapshot);
    return result.count;
  }

  async getLastSyncTime(): Promise<Date | null> {
    const [result] = await db.select()
      .from(syncLog)
      .where(eq(syncLog.status, 'completed'))
      .orderBy(desc(syncLog.completedAt))
      .limit(1);
    
    return result?.completedAt || null;
  }
}

// Singleton instance
export const dataSyncService = new DataSyncService();
