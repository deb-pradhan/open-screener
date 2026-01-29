import { db } from '../db';
import { 
  tickers, 
  dailyPrices, 
  dailyIndicators, 
  latestSnapshot, 
  syncLog,
  companyDetails,
  financialStatements,
  financialRatios,
  dividends,
  stockSplits,
  newsArticles,
  newsTickers,
  syncStatus,
  syncLocks,
  syncCheckpoints,
} from '../db/schema';
import { MassiveClient } from '../clients/massive';
import { eq, and, desc, sql, lt, isNull, or } from 'drizzle-orm';
import type { TickerSnapshot, SyncResult } from '@screener/shared';

// ============================================
// Retry Configuration
// ============================================
const RETRY_DELAYS = [
  5 * 60 * 1000,      // 5 minutes
  30 * 60 * 1000,     // 30 minutes  
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000 // 24 hours (then give up)
];

// ============================================
// Distributed Lock Manager
// ============================================
class SyncLockManager {
  private instanceId = crypto.randomUUID();
  
  async acquireLock(lockName: string, ttlMs: number = 300000): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    
    try {
      // Try to insert lock, or update if expired
      await db.insert(syncLocks)
        .values({
          lockName,
          lockedBy: this.instanceId,
          lockedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: syncLocks.lockName,
          set: {
            lockedBy: this.instanceId,
            lockedAt: now,
            expiresAt,
          },
          setWhere: lt(syncLocks.expiresAt, now), // Only if expired
        });
      
      // Verify we got the lock
      const [lock] = await db.select()
        .from(syncLocks)
        .where(eq(syncLocks.lockName, lockName));
      
      return lock?.lockedBy === this.instanceId;
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      return false;
    }
  }
  
  async releaseLock(lockName: string): Promise<void> {
    await db.delete(syncLocks)
      .where(and(
        eq(syncLocks.lockName, lockName),
        eq(syncLocks.lockedBy, this.instanceId)
      ));
  }
  
  async extendLock(lockName: string, ttlMs: number): Promise<boolean> {
    const result = await db.update(syncLocks)
      .set({ expiresAt: new Date(Date.now() + ttlMs) })
      .where(and(
        eq(syncLocks.lockName, lockName),
        eq(syncLocks.lockedBy, this.instanceId)
      ))
      .returning({ lockName: syncLocks.lockName });
    return result.length > 0;
  }
}

// ============================================
// Data Sync Service
// ============================================
export class DataSyncService {
  private massiveClient: MassiveClient;
  private lockManager: SyncLockManager;

  constructor() {
    this.massiveClient = new MassiveClient();
    this.lockManager = new SyncLockManager();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // Checkpointing
  // ============================================

  private async saveCheckpoint(syncType: string, lastSymbol: string, processedCount: number, totalCount?: number): Promise<void> {
    await db.insert(syncCheckpoints)
      .values({
        syncType,
        lastSymbol,
        processedCount,
        totalCount,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: syncCheckpoints.syncType,
        set: {
          lastSymbol,
          processedCount,
          totalCount,
          updatedAt: new Date(),
        },
      });
  }

  private async getCheckpoint(syncType: string): Promise<{ lastSymbol: string; processedCount: number } | null> {
    const [checkpoint] = await db.select()
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.syncType, syncType));
    
    return checkpoint ? { lastSymbol: checkpoint.lastSymbol, processedCount: checkpoint.processedCount ?? 0 } : null;
  }

  private async clearCheckpoint(syncType: string): Promise<void> {
    await db.delete(syncCheckpoints)
      .where(eq(syncCheckpoints.syncType, syncType));
  }

  // ============================================
  // Per-Symbol Sync Status
  // ============================================

  private async updateSyncStatus(
    symbol: string, 
    dataType: string, 
    status: 'success' | 'failed' | 'partial',
    errorMessage?: string
  ): Promise<void> {
    const now = new Date();
    
    await db.insert(syncStatus)
      .values({
        symbol,
        dataType,
        lastSyncedAt: status === 'success' ? now : undefined,
        lastSyncStatus: status,
        errorMessage: errorMessage || null,
        retryCount: status === 'failed' ? 1 : 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [syncStatus.symbol, syncStatus.dataType],
        set: {
          lastSyncedAt: status === 'success' ? now : undefined,
          lastSyncStatus: status,
          errorMessage: errorMessage || null,
          retryCount: status === 'success' ? 0 : sql`${syncStatus.retryCount} + 1`,
          updatedAt: now,
        },
      });
  }

  private async scheduleRetry(symbol: string, dataType: string): Promise<void> {
    const [status] = await db.select()
      .from(syncStatus)
      .where(and(
        eq(syncStatus.symbol, symbol),
        eq(syncStatus.dataType, dataType)
      ));
    
    const retryCount = (status?.retryCount || 0);
    
    if (retryCount >= RETRY_DELAYS.length) {
      console.error(`Max retries exceeded for ${symbol}:${dataType}`);
      return;
    }
    
    const nextRetry = new Date(Date.now() + RETRY_DELAYS[retryCount]);
    
    await db.update(syncStatus)
      .set({ nextRetryAt: nextRetry })
      .where(and(
        eq(syncStatus.symbol, symbol),
        eq(syncStatus.dataType, dataType)
      ));
  }

  private async getSymbolsNeedingSync(dataType: string, staleThreshold: Date, limit: number = 500): Promise<string[]> {
    // Get symbols that need syncing (never synced or stale)
    const results = await db
      .select({ symbol: latestSnapshot.symbol })
      .from(latestSnapshot)
      .leftJoin(
        syncStatus,
        and(
          eq(latestSnapshot.symbol, syncStatus.symbol),
          eq(syncStatus.dataType, dataType)
        )
      )
      .where(
        or(
          isNull(syncStatus.lastSyncedAt),
          lt(syncStatus.lastSyncedAt, staleThreshold)
        )
      )
      .orderBy(desc(latestSnapshot.volume))
      .limit(limit);
    
    return results.map(r => r.symbol);
  }

  // ============================================
  // Sync Logging
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
  // Hourly Snapshot Sync
  // ============================================

  async syncHourlySnapshot(): Promise<SyncResult> {
    const lockName = 'sync:snapshot';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('snapshot');

    try {
      console.log('Starting hourly snapshot sync...');
      
      const snapshots = await this.massiveClient.getMarketSnapshot();
      
      if (!snapshots || snapshots.length === 0) {
        throw new Error('No snapshot data received from API');
      }

      console.log(`Received ${snapshots.length} tickers from API`);

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

        if (processed % 500 === 0) {
          console.log(`Progress: ${processed}/${snapshots.length} processed`);
          await this.lockManager.extendLock(lockName, 300000);
        }
      }

      await this.completeSyncLog(logId, processed, failed);
      console.log(`Hourly sync complete: ${processed} processed, ${failed} failed`);

      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // Daily Data Sync (with indicators)
  // ============================================

  async syncDailyData(): Promise<SyncResult> {
    const lockName = 'sync:daily';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('daily');

    try {
      console.log('Starting daily data sync...');
      
      const snapshots = await this.massiveClient.getMarketSnapshot();
      
      if (!snapshots || snapshots.length === 0) {
        throw new Error('No snapshot data received');
      }

      const today = new Date().toISOString().split('T')[0];
      let processed = 0;
      let failed = 0;

      const topStocks = snapshots
        .filter(s => s.day?.v && s.day.v > 100000)
        .sort((a, b) => (b.day?.v || 0) - (a.day?.v || 0))
        .slice(0, 1000);

      console.log(`Processing ${topStocks.length} stocks with volume > 100K`);

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

        await this.sleep(100);
        
        if (processed % 100 === 0) {
          console.log(`Progress: ${processed}/${topStocks.length}`);
          await this.lockManager.extendLock(lockName, 300000);
        }
      }

      await this.completeSyncLog(logId, processed, failed);
      console.log(`Daily sync complete: ${processed} processed, ${failed} failed`);

      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // Financials Sync
  // ============================================

  async syncFinancials(options?: {
    symbols?: string[];
    resumeFromCheckpoint?: boolean;
  }): Promise<SyncResult> {
    const lockName = 'sync:financials';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('financials');

    try {
      let symbols = options?.symbols;
      
      if (!symbols) {
        const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        symbols = await this.getSymbolsNeedingSync('financials', staleThreshold, 500);
      }
      
      if (options?.resumeFromCheckpoint) {
        const checkpoint = await this.getCheckpoint('financials');
        if (checkpoint) {
          const idx = symbols.indexOf(checkpoint.lastSymbol);
          if (idx > -1) symbols = symbols.slice(idx);
        }
      }

      console.log(`Syncing financials for ${symbols.length} symbols...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const symbol of symbols) {
        try {
          await this.syncSymbolFinancials(symbol);
          await this.updateSyncStatus(symbol, 'financials', 'success');
          processed++;
          
          if (processed % 10 === 0) {
            await this.saveCheckpoint('financials', symbol, processed, symbols.length);
            await this.lockManager.extendLock(lockName, 300000);
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.updateSyncStatus(symbol, 'financials', 'failed', errorMsg);
          await this.scheduleRetry(symbol, 'financials');
          console.error(`Failed to sync financials for ${symbol}:`, errorMsg);
        }
        
        await this.sleep(200);
      }
      
      await this.completeSyncLog(logId, processed, failed);
      await this.clearCheckpoint('financials');
      
      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  private async syncSymbolFinancials(symbol: string): Promise<void> {
    const [income, balance, cashFlow] = await Promise.all([
      this.massiveClient.getIncomeStatements(symbol, { timeframe: 'quarterly', limit: 8 }),
      this.massiveClient.getBalanceSheets(symbol, { timeframe: 'quarterly', limit: 8 }),
      this.massiveClient.getCashFlowStatements(symbol, { timeframe: 'quarterly', limit: 8 }),
    ]);
    
    // Store income statements
    for (const stmt of income) {
      await db.insert(financialStatements)
        .values({
          symbol,
          statementType: 'income',
          timeframe: stmt.timeframe as 'quarterly' | 'annual' | 'ttm',
          fiscalYear: stmt.fiscal_year,
          fiscalQuarter: stmt.fiscal_period === 'Q1' ? 1 : stmt.fiscal_period === 'Q2' ? 2 : stmt.fiscal_period === 'Q3' ? 3 : 4,
          periodEnd: stmt.end_date,
          filingDate: stmt.filing_date,
          rawData: stmt,
          revenue: stmt.revenues?.value,
          netIncome: stmt.net_income_loss?.value,
          eps: stmt.basic_earnings_per_share?.value,
        })
        .onConflictDoNothing();
    }

    // Store balance sheets
    for (const stmt of balance) {
      await db.insert(financialStatements)
        .values({
          symbol,
          statementType: 'balance',
          timeframe: stmt.timeframe as 'quarterly' | 'annual' | 'ttm',
          fiscalYear: stmt.fiscal_year,
          fiscalQuarter: stmt.fiscal_period === 'Q1' ? 1 : stmt.fiscal_period === 'Q2' ? 2 : stmt.fiscal_period === 'Q3' ? 3 : 4,
          periodEnd: stmt.end_date,
          filingDate: stmt.filing_date,
          rawData: stmt,
          totalAssets: stmt.assets?.value,
          totalLiabilities: stmt.liabilities?.value,
        })
        .onConflictDoNothing();
    }

    // Store cash flow statements
    for (const stmt of cashFlow) {
      await db.insert(financialStatements)
        .values({
          symbol,
          statementType: 'cashflow',
          timeframe: stmt.timeframe as 'quarterly' | 'annual' | 'ttm',
          fiscalYear: stmt.fiscal_year,
          fiscalQuarter: stmt.fiscal_period === 'Q1' ? 1 : stmt.fiscal_period === 'Q2' ? 2 : stmt.fiscal_period === 'Q3' ? 3 : 4,
          periodEnd: stmt.end_date,
          filingDate: stmt.filing_date,
          rawData: stmt,
          operatingCashFlow: stmt.net_cash_flow_from_operating_activities?.value,
        })
        .onConflictDoNothing();
    }

    // Update derived fields in latest_snapshot
    await this.updateSnapshotFundamentals(symbol, income);
  }

  private async updateSnapshotFundamentals(symbol: string, incomeStatements: any[]): Promise<void> {
    if (incomeStatements.length < 5) return; // Need at least 5 quarters for YoY comparison
    
    const latestIncome = incomeStatements[0];
    const prevYearIncome = incomeStatements.find((i: any) => 
      i.fiscal_year === latestIncome?.fiscal_year - 1 &&
      i.fiscal_period === latestIncome?.fiscal_period
    );
    
    let revenueGrowth: number | null = null;
    let epsGrowth: number | null = null;
    
    if (prevYearIncome?.revenues?.value && latestIncome?.revenues?.value) {
      revenueGrowth = ((latestIncome.revenues.value - prevYearIncome.revenues.value) / Math.abs(prevYearIncome.revenues.value)) * 100;
    }
    
    if (prevYearIncome?.basic_earnings_per_share?.value && latestIncome?.basic_earnings_per_share?.value) {
      epsGrowth = ((latestIncome.basic_earnings_per_share.value - prevYearIncome.basic_earnings_per_share.value) / Math.abs(prevYearIncome.basic_earnings_per_share.value)) * 100;
    }
    
    await db.update(latestSnapshot)
      .set({
        revenueGrowthYoy: revenueGrowth,
        epsGrowthYoy: epsGrowth,
        financialsLastSync: new Date(),
      })
      .where(eq(latestSnapshot.symbol, symbol));
  }

  // ============================================
  // Financial Ratios Sync
  // ============================================

  async syncFinancialRatios(symbols?: string[]): Promise<SyncResult> {
    const lockName = 'sync:ratios';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('ratios');

    try {
      if (!symbols) {
        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
        symbols = await this.getSymbolsNeedingSync('ratios', staleThreshold, 500);
      }

      console.log(`Syncing ratios for ${symbols.length} symbols...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const symbol of symbols) {
        try {
          const ratios = await this.massiveClient.getFinancialRatios(symbol);
          
          if (ratios) {
            await db.insert(financialRatios)
              .values({
                symbol,
                peRatio: ratios.peRatio,
                pbRatio: ratios.pbRatio,
                psRatio: ratios.psRatio,
                evToEbitda: ratios.evToEbitda,
                pegRatio: ratios.pegRatio,
                grossMargin: ratios.grossMargin,
                operatingMargin: ratios.operatingMargin,
                netMargin: ratios.netMargin,
                roe: ratios.roe,
                roa: ratios.roa,
                roic: ratios.roic,
                currentRatio: ratios.currentRatio,
                quickRatio: ratios.quickRatio,
                debtToEquity: ratios.debtToEquity,
                interestCoverage: ratios.interestCoverage,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: financialRatios.symbol,
                set: {
                  peRatio: ratios.peRatio,
                  pbRatio: ratios.pbRatio,
                  psRatio: ratios.psRatio,
                  evToEbitda: ratios.evToEbitda,
                  pegRatio: ratios.pegRatio,
                  grossMargin: ratios.grossMargin,
                  operatingMargin: ratios.operatingMargin,
                  netMargin: ratios.netMargin,
                  roe: ratios.roe,
                  roa: ratios.roa,
                  roic: ratios.roic,
                  currentRatio: ratios.currentRatio,
                  quickRatio: ratios.quickRatio,
                  debtToEquity: ratios.debtToEquity,
                  interestCoverage: ratios.interestCoverage,
                  lastSyncedAt: new Date(),
                  updatedAt: new Date(),
                },
              });

            // Update latest_snapshot with key ratios
            await db.update(latestSnapshot)
              .set({
                peRatio: ratios.peRatio,
                pbRatio: ratios.pbRatio,
                grossMargin: ratios.grossMargin,
                debtToEquity: ratios.debtToEquity,
                ratiosLastSync: new Date(),
              })
              .where(eq(latestSnapshot.symbol, symbol));
          }
          
          await this.updateSyncStatus(symbol, 'ratios', 'success');
          processed++;
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.updateSyncStatus(symbol, 'ratios', 'failed', errorMsg);
        }
        
        await this.sleep(200);
        
        if (processed % 50 === 0) {
          await this.lockManager.extendLock(lockName, 300000);
        }
      }
      
      await this.completeSyncLog(logId, processed, failed);
      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // Dividends Sync
  // ============================================

  async syncDividends(symbols?: string[]): Promise<SyncResult> {
    const lockName = 'sync:dividends';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('dividends');

    try {
      if (!symbols) {
        const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        symbols = await this.getSymbolsNeedingSync('dividends', staleThreshold, 500);
      }

      console.log(`Syncing dividends for ${symbols.length} symbols...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const symbol of symbols) {
        try {
          const divs = await this.massiveClient.getDividends(symbol, { limit: 20 });
          
          for (const div of divs) {
            await db.insert(dividends)
              .values({
                symbol,
                exDividendDate: div.exDividendDate,
                payDate: div.payDate,
                recordDate: div.recordDate,
                declarationDate: div.declarationDate,
                amount: div.amount,
                frequency: div.frequency,
                dividendType: div.dividendType,
              })
              .onConflictDoNothing();
          }

          // Calculate and update dividend yield
          const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const annualDividend = divs
            .filter(d => d.exDividendDate >= oneYearAgo)
            .reduce((sum, d) => sum + d.amount, 0);
          
          const [snapshot] = await db.select({ price: latestSnapshot.price })
            .from(latestSnapshot)
            .where(eq(latestSnapshot.symbol, symbol));
          
          if (snapshot?.price && annualDividend > 0) {
            const dividendYield = (annualDividend / snapshot.price) * 100;
            await db.update(latestSnapshot)
              .set({ dividendYield })
              .where(eq(latestSnapshot.symbol, symbol));
          }
          
          await this.updateSyncStatus(symbol, 'dividends', 'success');
          processed++;
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.updateSyncStatus(symbol, 'dividends', 'failed', errorMsg);
        }
        
        await this.sleep(200);
      }
      
      await this.completeSyncLog(logId, processed, failed);
      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // Stock Splits Sync
  // ============================================

  async syncStockSplits(symbols?: string[]): Promise<SyncResult> {
    const lockName = 'sync:splits';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('splits');

    try {
      if (!symbols) {
        const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        symbols = await this.getSymbolsNeedingSync('splits', staleThreshold, 500);
      }

      console.log(`Syncing splits for ${symbols.length} symbols...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const symbol of symbols) {
        try {
          const splits = await this.massiveClient.getStockSplits(symbol, { limit: 20 });
          
          for (const split of splits) {
            await db.insert(stockSplits)
              .values({
                symbol,
                executionDate: split.executionDate,
                splitFrom: split.splitFrom,
                splitTo: split.splitTo,
              })
              .onConflictDoNothing();
          }
          
          await this.updateSyncStatus(symbol, 'splits', 'success');
          processed++;
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.updateSyncStatus(symbol, 'splits', 'failed', errorMsg);
        }
        
        await this.sleep(200);
      }
      
      await this.completeSyncLog(logId, processed, failed);
      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // News Sync
  // ============================================

  async syncNews(): Promise<SyncResult> {
    const lockName = 'sync:news';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('news');

    try {
      // Get last hour of news
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const articles = await this.massiveClient.getNews({ 
        limit: 100,
        published_utc_gte: oneHourAgo,
      });

      console.log(`Syncing ${articles.length} news articles...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const article of articles) {
        try {
          // Insert article
          await db.insert(newsArticles)
            .values({
              id: article.id,
              publishedAt: new Date(article.publishedAt),
              title: article.title,
              author: article.author,
              articleUrl: article.articleUrl,
              imageUrl: article.imageUrl,
              description: article.description,
              keywords: article.keywords,
              publisher: article.publisher,
            })
            .onConflictDoNothing();

          // Insert ticker associations
          if (article.tickers && article.tickers.length > 0) {
            for (const ticker of article.tickers) {
              await db.insert(newsTickers)
                .values({
                  articleId: article.id,
                  symbol: ticker,
                })
                .onConflictDoNothing();
            }
          }
          
          processed++;
        } catch (error) {
          failed++;
        }
      }
      
      await this.completeSyncLog(logId, processed, failed);
      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // Company Details Sync
  // ============================================

  async syncCompanyDetails(symbols?: string[]): Promise<SyncResult> {
    const lockName = 'sync:details';
    
    if (!await this.lockManager.acquireLock(lockName)) {
      return { status: 'skipped', reason: 'Another instance is syncing' };
    }

    const logId = await this.startSyncLog('details');

    try {
      if (!symbols) {
        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
        symbols = await this.getSymbolsNeedingSync('details', staleThreshold, 500);
      }

      console.log(`Syncing company details for ${symbols.length} symbols...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const symbol of symbols) {
        try {
          const details = await this.massiveClient.getTickerDetailsExtended(symbol);
          
          if (details) {
            await db.insert(companyDetails)
              .values({
                symbol,
                description: details.description,
                homepageUrl: details.homepageUrl,
                phoneNumber: details.phoneNumber,
                address: details.address,
                sicCode: details.sicCode,
                sicDescription: details.sicDescription,
                totalEmployees: details.totalEmployees,
                listDate: details.listDate,
                marketCap: details.marketCap,
                sharesOutstanding: details.sharesOutstanding,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: companyDetails.symbol,
                set: {
                  description: details.description,
                  homepageUrl: details.homepageUrl,
                  phoneNumber: details.phoneNumber,
                  address: details.address,
                  sicCode: details.sicCode,
                  sicDescription: details.sicDescription,
                  totalEmployees: details.totalEmployees,
                  marketCap: details.marketCap,
                  sharesOutstanding: details.sharesOutstanding,
                  lastSyncedAt: new Date(),
                  updatedAt: new Date(),
                },
              });

            // Update market cap in latest_snapshot
            if (details.marketCap) {
              await db.update(latestSnapshot)
                .set({ marketCap: details.marketCap })
                .where(eq(latestSnapshot.symbol, symbol));
            }
          }
          
          await this.updateSyncStatus(symbol, 'details', 'success');
          processed++;
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.updateSyncStatus(symbol, 'details', 'failed', errorMsg);
        }
        
        await this.sleep(200);
        
        if (processed % 50 === 0) {
          await this.lockManager.extendLock(lockName, 300000);
        }
      }
      
      await this.completeSyncLog(logId, processed, failed);
      return { status: 'completed', processed, failed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.failSyncLog(logId, errorMsg);
      return { status: 'failed', reason: errorMsg };
    } finally {
      await this.lockManager.releaseLock(lockName);
    }
  }

  // ============================================
  // On-Demand Symbol Refresh
  // ============================================

  async refreshSymbol(symbol: string, dataTypes: string[]): Promise<void> {
    for (const dataType of dataTypes) {
      try {
        switch (dataType) {
          case 'ratios':
            await this.syncFinancialRatios([symbol]);
            break;
          case 'financials':
            await this.syncFinancials({ symbols: [symbol] });
            break;
          case 'dividends':
            await this.syncDividends([symbol]);
            break;
          case 'details':
            await this.syncCompanyDetails([symbol]);
            break;
        }
      } catch (error) {
        console.error(`Failed to refresh ${dataType} for ${symbol}:`, error);
      }
    }
  }

  // ============================================
  // Legacy Methods (kept for compatibility)
  // ============================================

  async backfillSymbol(symbol: string, days: number = 30): Promise<void> {
    console.log(`Backfilling ${days} days for ${symbol}...`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
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

  private async processStockWithIndicators(
    snapshot: TickerSnapshot,
    dateStr: string
  ): Promise<void> {
    const symbol = snapshot.ticker;
    const dayData = snapshot.day || snapshot.prevDay;
    
    if (!dayData) return;

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

    const [rsi, sma20, sma50, sma200, ema12, ema26] = await Promise.all([
      this.massiveClient.getRSI(symbol, 14).catch(() => null),
      this.massiveClient.getSMA(symbol, 20).catch(() => null),
      this.massiveClient.getSMA(symbol, 50).catch(() => null),
      this.massiveClient.getSMA(symbol, 200).catch(() => null),
      this.massiveClient.getEMA(symbol, 12).catch(() => null),
      this.massiveClient.getEMA(symbol, 26).catch(() => null),
    ]);

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

    const details = await this.massiveClient.getTickerDetails(symbol).catch(() => null);

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
        marketCap: details?.market_cap,
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
          marketCap: details?.market_cap,
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

  async syncMissingLogos(limit: number = 500): Promise<{ processed: number; failed: number }> {
    console.log('Starting logo sync for stocks missing logos...');
    
    try {
      const stocksWithoutLogos = await db
        .select({ symbol: latestSnapshot.symbol })
        .from(latestSnapshot)
        .where(isNull(latestSnapshot.logoUrl))
        .orderBy(desc(latestSnapshot.volume))
        .limit(limit);
      
      if (stocksWithoutLogos.length === 0) {
        console.log('All stocks have logos');
        return { processed: 0, failed: 0 };
      }

      console.log(`Found ${stocksWithoutLogos.length} stocks without logos`);
      
      let processed = 0;
      let failed = 0;
      const batchSize = 20;

      for (let i = 0; i < stocksWithoutLogos.length; i += batchSize) {
        const batch = stocksWithoutLogos.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(async ({ symbol }) => {
            const details = await this.massiveClient.getTickerDetails(symbol);
            
            if (details) {
              await db.update(latestSnapshot)
                .set({
                  name: details.name || symbol,
                  logoUrl: details.branding?.logo_url,
                })
                .where(eq(latestSnapshot.symbol, symbol));
            }
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') processed++;
          else failed++;
        }

        if (i + batchSize < stocksWithoutLogos.length) {
          await this.sleep(100);
        }

        if (processed % 100 === 0) {
          console.log(`Logo sync progress: ${processed}/${stocksWithoutLogos.length}`);
        }
      }

      console.log(`Logo sync complete: ${processed} processed, ${failed} failed`);
      return { processed, failed };
    } catch (error) {
      console.error('Logo sync failed:', error);
      throw error;
    }
  }

  // ============================================
  // Query Helpers
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
