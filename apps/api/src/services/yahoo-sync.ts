import { db, isDbConnected } from '../db';
import {
  companyDetails,
  financialRatios,
  earningsHistory,
  analystRecommendations,
  upgradeDowngrades,
  holdersBreakdown,
  institutionalHolders,
  insiderTransactions,
  yahooSyncCache,
  latestSnapshot,
} from '../db/schema';
import { yahooClient } from '../clients/yahoo';
import { eq } from 'drizzle-orm';

// Stale thresholds in milliseconds
const STALE_THRESHOLDS = {
  quote: 5 * 60 * 1000, // 5 minutes
  profile: 24 * 60 * 60 * 1000, // 24 hours
  stats: 60 * 60 * 1000, // 1 hour
  earnings: 60 * 60 * 1000, // 1 hour
  analysts: 60 * 60 * 1000, // 1 hour
  holders: 24 * 60 * 60 * 1000, // 24 hours
  fullData: 15 * 60 * 1000, // 15 minutes
};

export class YahooSyncService {
  /**
   * Check if data for a symbol is stale and needs refresh
   */
  async isDataStale(symbol: string, dataType: keyof typeof STALE_THRESHOLDS = 'fullData'): Promise<boolean> {
    if (!isDbConnected()) return true;

    try {
      const [cache] = await db
        .select()
        .from(yahooSyncCache)
        .where(eq(yahooSyncCache.symbol, symbol));

      if (!cache) return true;

      const syncedAt = dataType === 'fullData' 
        ? cache.fullDataSyncedAt
        : cache[`${dataType}SyncedAt` as keyof typeof cache] as Date | null;

      if (!syncedAt) return true;

      const threshold = STALE_THRESHOLDS[dataType];
      return Date.now() - syncedAt.getTime() > threshold;
    } catch (error) {
      console.error('Error checking data staleness:', error);
      return true;
    }
  }

  /**
   * Sync all Yahoo data for a symbol and store in database
   */
  async syncSymbol(symbol: string, options?: { force?: boolean }): Promise<{
    success: boolean;
    fromCache?: boolean;
    error?: string;
  }> {
    if (!isDbConnected()) {
      return { success: false, error: 'Database not available' };
    }

    try {
      // Check if we need to sync
      if (!options?.force) {
        const isStale = await this.isDataStale(symbol);
        if (!isStale) {
          return { success: true, fromCache: true };
        }
      }

      // Fetch from Yahoo (will use cache if available)
      const yahooData = await yahooClient.getTickerData(symbol, { skipCache: options?.force });

      if (!yahooData.quote && !yahooData.profile) {
        return { success: false, error: 'No data returned from Yahoo' };
      }

      // Start a pseudo-transaction (batch all updates)
      const now = new Date();

      // 1. Sync company details/profile
      if (yahooData.profile) {
        await this.syncCompanyProfile(symbol, yahooData.profile, now);
      }

      // 2. Sync financial ratios and stats
      if (yahooData.stats || yahooData.quote) {
        await this.syncFinancialRatios(symbol, yahooData.stats, yahooData.quote, now);
      }

      // 3. Sync earnings history
      if (yahooData.earnings?.earningsHistory) {
        await this.syncEarningsHistory(symbol, yahooData.earnings.earningsHistory);
      }

      // 4. Sync analyst recommendations
      if (yahooData.recommendations) {
        await this.syncAnalystRecommendations(symbol, yahooData.recommendations);
      }

      // 5. Sync upgrade/downgrades
      if (yahooData.upgradeDowngrades) {
        await this.syncUpgradeDowngrades(symbol, yahooData.upgradeDowngrades);
      }

      // 6. Sync holders breakdown
      if (yahooData.holdersBreakdown) {
        await this.syncHoldersBreakdown(symbol, yahooData.holdersBreakdown, now);
      }

      // 7. Sync institutional holders
      if (yahooData.institutionalHolders) {
        await this.syncInstitutionalHolders(symbol, yahooData.institutionalHolders);
      }

      // 8. Sync insider transactions
      if (yahooData.insiderTransactions) {
        await this.syncInsiderTransactions(symbol, yahooData.insiderTransactions);
      }

      // 9. Update latest snapshot with key data
      if (yahooData.quote) {
        await this.updateLatestSnapshot(symbol, yahooData.quote, yahooData.stats);
      }

      // 10. Update sync cache
      await this.updateSyncCache(symbol, now);

      return { success: true, fromCache: yahooData._fromCache };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Yahoo sync failed for ${symbol}:`, errorMsg);

      // Track error in sync cache
      await this.trackSyncError(symbol, errorMsg);

      return { success: false, error: errorMsg };
    }
  }

  private async syncCompanyProfile(
    symbol: string,
    profile: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['profile']>,
    syncedAt: Date
  ): Promise<void> {
    await db
      .insert(companyDetails)
      .values({
        symbol,
        description: profile.longBusinessSummary,
        homepageUrl: profile.website,
        phoneNumber: profile.phone,
        address: profile.address1
          ? {
              address1: profile.address1,
              city: profile.city,
              state: profile.state,
              postalCode: profile.zip,
              country: profile.country,
            }
          : null,
        industry: profile.industry,
        industryKey: profile.industryKey,
        sector: profile.sector,
        sectorKey: profile.sectorKey,
        totalEmployees: profile.fullTimeEmployees,
        companyOfficers: profile.companyOfficers,
        auditRisk: profile.auditRisk,
        boardRisk: profile.boardRisk,
        compensationRisk: profile.compensationRisk,
        shareholderRightsRisk: profile.shareHolderRightsRisk,
        overallRisk: profile.overallRisk,
        yahooSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: companyDetails.symbol,
        set: {
          description: profile.longBusinessSummary,
          homepageUrl: profile.website,
          phoneNumber: profile.phone,
          address: profile.address1
            ? {
                address1: profile.address1,
                city: profile.city,
                state: profile.state,
                postalCode: profile.zip,
                country: profile.country,
              }
            : null,
          industry: profile.industry,
          industryKey: profile.industryKey,
          sector: profile.sector,
          sectorKey: profile.sectorKey,
          totalEmployees: profile.fullTimeEmployees,
          companyOfficers: profile.companyOfficers,
          auditRisk: profile.auditRisk,
          boardRisk: profile.boardRisk,
          compensationRisk: profile.compensationRisk,
          shareholderRightsRisk: profile.shareHolderRightsRisk,
          overallRisk: profile.overallRisk,
          yahooSyncedAt: syncedAt,
          updatedAt: syncedAt,
        },
      });
  }

  private async syncFinancialRatios(
    symbol: string,
    stats: Awaited<ReturnType<typeof yahooClient.getTickerData>>['stats'],
    quote: Awaited<ReturnType<typeof yahooClient.getTickerData>>['quote'],
    syncedAt: Date
  ): Promise<void> {
    await db
      .insert(financialRatios)
      .values({
        symbol,
        peRatio: stats?.trailingPE,
        forwardPe: stats?.forwardPE,
        pbRatio: stats?.priceToBook,
        psRatio: stats?.priceToSalesTrailing12Months,
        evToEbitda: stats?.enterpriseToEbitda,
        evToRevenue: stats?.enterpriseToRevenue,
        pegRatio: stats?.pegRatio,
        grossMargin: stats?.grossMargins ? stats.grossMargins * 100 : undefined,
        operatingMargin: stats?.operatingMargins ? stats.operatingMargins * 100 : undefined,
        ebitdaMargin: stats?.ebitdaMargins ? stats.ebitdaMargins * 100 : undefined,
        netMargin: stats?.profitMargins ? stats.profitMargins * 100 : undefined,
        roe: stats?.returnOnEquity ? stats.returnOnEquity * 100 : undefined,
        roa: stats?.returnOnAssets ? stats.returnOnAssets * 100 : undefined,
        currentRatio: stats?.currentRatio,
        quickRatio: stats?.quickRatio,
        debtToEquity: stats?.debtToEquity,
        revenueGrowth: stats?.revenueGrowth ? stats.revenueGrowth * 100 : undefined,
        earningsGrowth: stats?.earningsGrowth ? stats.earningsGrowth * 100 : undefined,
        revenueGrowthQuarterly: stats?.revenueQuarterlyGrowth ? stats.revenueQuarterlyGrowth * 100 : undefined,
        earningsGrowthQuarterly: stats?.earningsQuarterlyGrowth ? stats.earningsQuarterlyGrowth * 100 : undefined,
        freeCashFlow: stats?.freeCashflow,
        operatingCashFlow: stats?.operatingCashflow,
        targetHighPrice: stats?.targetHighPrice,
        targetLowPrice: stats?.targetLowPrice,
        targetMeanPrice: stats?.targetMeanPrice,
        targetMedianPrice: stats?.targetMedianPrice,
        numberOfAnalysts: stats?.numberOfAnalystOpinions,
        recommendationKey: stats?.recommendationKey,
        recommendationMean: stats?.recommendationMean,
        yahooSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: financialRatios.symbol,
        set: {
          peRatio: stats?.trailingPE,
          forwardPe: stats?.forwardPE,
          pbRatio: stats?.priceToBook,
          psRatio: stats?.priceToSalesTrailing12Months,
          evToEbitda: stats?.enterpriseToEbitda,
          evToRevenue: stats?.enterpriseToRevenue,
          pegRatio: stats?.pegRatio,
          grossMargin: stats?.grossMargins ? stats.grossMargins * 100 : undefined,
          operatingMargin: stats?.operatingMargins ? stats.operatingMargins * 100 : undefined,
          ebitdaMargin: stats?.ebitdaMargins ? stats.ebitdaMargins * 100 : undefined,
          netMargin: stats?.profitMargins ? stats.profitMargins * 100 : undefined,
          roe: stats?.returnOnEquity ? stats.returnOnEquity * 100 : undefined,
          roa: stats?.returnOnAssets ? stats.returnOnAssets * 100 : undefined,
          currentRatio: stats?.currentRatio,
          quickRatio: stats?.quickRatio,
          debtToEquity: stats?.debtToEquity,
          revenueGrowth: stats?.revenueGrowth ? stats.revenueGrowth * 100 : undefined,
          earningsGrowth: stats?.earningsGrowth ? stats.earningsGrowth * 100 : undefined,
          revenueGrowthQuarterly: stats?.revenueQuarterlyGrowth ? stats.revenueQuarterlyGrowth * 100 : undefined,
          earningsGrowthQuarterly: stats?.earningsQuarterlyGrowth ? stats.earningsQuarterlyGrowth * 100 : undefined,
          freeCashFlow: stats?.freeCashflow,
          operatingCashFlow: stats?.operatingCashflow,
          targetHighPrice: stats?.targetHighPrice,
          targetLowPrice: stats?.targetLowPrice,
          targetMeanPrice: stats?.targetMeanPrice,
          targetMedianPrice: stats?.targetMedianPrice,
          numberOfAnalysts: stats?.numberOfAnalystOpinions,
          recommendationKey: stats?.recommendationKey,
          recommendationMean: stats?.recommendationMean,
          yahooSyncedAt: syncedAt,
          updatedAt: syncedAt,
        },
      });
  }

  private async syncEarningsHistory(
    symbol: string,
    history: NonNullable<NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['earnings']>['earningsHistory']>
  ): Promise<void> {
    for (const item of history) {
      await db
        .insert(earningsHistory)
        .values({
          symbol,
          quarter: item.quarter,
          epsActual: item.epsActual,
          epsEstimate: item.epsEstimate,
          epsDifference: item.epsDifference,
          surprisePercent: item.surprisePercent,
        })
        .onConflictDoUpdate({
          target: [earningsHistory.symbol, earningsHistory.quarter],
          set: {
            epsActual: item.epsActual,
            epsEstimate: item.epsEstimate,
            epsDifference: item.epsDifference,
            surprisePercent: item.surprisePercent,
          },
        });
    }
  }

  private async syncAnalystRecommendations(
    symbol: string,
    recommendations: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['recommendations']>
  ): Promise<void> {
    for (const rec of recommendations) {
      await db
        .insert(analystRecommendations)
        .values({
          symbol,
          period: rec.period,
          strongBuy: rec.strongBuy,
          buy: rec.buy,
          hold: rec.hold,
          sell: rec.sell,
          strongSell: rec.strongSell,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [analystRecommendations.symbol, analystRecommendations.period],
          set: {
            strongBuy: rec.strongBuy,
            buy: rec.buy,
            hold: rec.hold,
            sell: rec.sell,
            strongSell: rec.strongSell,
            updatedAt: new Date(),
          },
        });
    }
  }

  private async syncUpgradeDowngrades(
    symbol: string,
    upgrades: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['upgradeDowngrades']>
  ): Promise<void> {
    // Delete existing and insert fresh (simpler than upsert for this data)
    // We keep only recent upgrades/downgrades
    for (const item of upgrades.slice(0, 20)) {
      await db
        .insert(upgradeDowngrades)
        .values({
          symbol,
          gradeDate: item.date,
          firm: item.firm,
          toGrade: item.toGrade,
          fromGrade: item.fromGrade,
          action: item.action,
        })
        .onConflictDoNothing(); // Avoid duplicates
    }
  }

  private async syncHoldersBreakdown(
    symbol: string,
    holders: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['holdersBreakdown']>,
    syncedAt: Date
  ): Promise<void> {
    await db
      .insert(holdersBreakdown)
      .values({
        symbol,
        insidersPercentHeld: holders.insidersPercentHeld,
        institutionsPercentHeld: holders.institutionsPercentHeld,
        institutionsFloatPercentHeld: holders.institutionsFloatPercentHeld,
        institutionsCount: holders.institutionsCount,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: holdersBreakdown.symbol,
        set: {
          insidersPercentHeld: holders.insidersPercentHeld,
          institutionsPercentHeld: holders.institutionsPercentHeld,
          institutionsFloatPercentHeld: holders.institutionsFloatPercentHeld,
          institutionsCount: holders.institutionsCount,
          lastSyncedAt: syncedAt,
          updatedAt: syncedAt,
        },
      });
  }

  private async syncInstitutionalHolders(
    symbol: string,
    holders: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['institutionalHolders']>
  ): Promise<void> {
    for (const holder of holders) {
      await db
        .insert(institutionalHolders)
        .values({
          symbol,
          holderName: holder.holder,
          shares: holder.shares,
          percentHeld: holder.pctHeld,
          value: holder.value,
          dateReported: holder.dateReported instanceof Date 
            ? holder.dateReported.toISOString().split('T')[0]
            : undefined,
        })
        .onConflictDoUpdate({
          target: [institutionalHolders.symbol, institutionalHolders.holderName],
          set: {
            shares: holder.shares,
            percentHeld: holder.pctHeld,
            value: holder.value,
            dateReported: holder.dateReported instanceof Date 
              ? holder.dateReported.toISOString().split('T')[0]
              : undefined,
          },
        });
    }
  }

  private async syncInsiderTransactions(
    symbol: string,
    transactions: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['insiderTransactions']>
  ): Promise<void> {
    for (const tx of transactions) {
      const txDate = tx.startDate instanceof Date 
        ? tx.startDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      await db
        .insert(insiderTransactions)
        .values({
          symbol,
          filerName: tx.filerName,
          filerRelation: tx.filerRelation,
          transactionText: tx.transactionText,
          shares: tx.shares,
          value: tx.value,
          transactionDate: txDate,
        })
        .onConflictDoNothing(); // Avoid duplicates
    }
  }

  private async updateLatestSnapshot(
    symbol: string,
    quote: NonNullable<Awaited<ReturnType<typeof yahooClient.getTickerData>>['quote']>,
    stats: Awaited<ReturnType<typeof yahooClient.getTickerData>>['stats']
  ): Promise<void> {
    // Only update fields that come from Yahoo, don't overwrite price data from Polygon
    await db
      .update(latestSnapshot)
      .set({
        name: quote.longName || quote.shortName,
        marketCap: quote.marketCap,
        peRatio: quote.trailingPE,
        pbRatio: quote.priceToBook,
        dividendYield: quote.dividendYield ? quote.dividendYield * 100 : undefined,
        grossMargin: stats?.grossMargins ? stats.grossMargins * 100 : undefined,
        debtToEquity: stats?.debtToEquity,
        ratiosLastSync: new Date(),
      })
      .where(eq(latestSnapshot.symbol, symbol));
  }

  private async updateSyncCache(symbol: string, syncedAt: Date): Promise<void> {
    await db
      .insert(yahooSyncCache)
      .values({
        symbol,
        quoteSyncedAt: syncedAt,
        profileSyncedAt: syncedAt,
        statsSyncedAt: syncedAt,
        earningsSyncedAt: syncedAt,
        analystsSyncedAt: syncedAt,
        holdersSyncedAt: syncedAt,
        fullDataSyncedAt: syncedAt,
        errorCount: 0,
        lastError: null,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: yahooSyncCache.symbol,
        set: {
          quoteSyncedAt: syncedAt,
          profileSyncedAt: syncedAt,
          statsSyncedAt: syncedAt,
          earningsSyncedAt: syncedAt,
          analystsSyncedAt: syncedAt,
          holdersSyncedAt: syncedAt,
          fullDataSyncedAt: syncedAt,
          errorCount: 0,
          lastError: null,
          updatedAt: syncedAt,
        },
      });
  }

  private async trackSyncError(symbol: string, error: string): Promise<void> {
    try {
      await db
        .insert(yahooSyncCache)
        .values({
          symbol,
          lastError: error,
          errorCount: 1,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: yahooSyncCache.symbol,
          set: {
            lastError: error,
            errorCount: 1, // Reset or could increment
            updatedAt: new Date(),
          },
        });
    } catch (e) {
      // Ignore errors while tracking errors
    }
  }

  /**
   * Get data from database for a symbol
   */
  async getFromDatabase(symbol: string): Promise<{
    company: typeof companyDetails.$inferSelect | null;
    ratios: typeof financialRatios.$inferSelect | null;
    earnings: (typeof earningsHistory.$inferSelect)[] | null;
    recommendations: (typeof analystRecommendations.$inferSelect)[] | null;
    upgrades: (typeof upgradeDowngrades.$inferSelect)[] | null;
    holders: typeof holdersBreakdown.$inferSelect | null;
    institutionalHolders: (typeof institutionalHolders.$inferSelect)[] | null;
    insiderTx: (typeof insiderTransactions.$inferSelect)[] | null;
  } | null> {
    if (!isDbConnected()) return null;

    try {
      const [company, ratios, earnings, recommendations, upgrades, holders, instHolders, insiderTx] = await Promise.all([
        db.select().from(companyDetails).where(eq(companyDetails.symbol, symbol)).then(r => r[0] || null),
        db.select().from(financialRatios).where(eq(financialRatios.symbol, symbol)).then(r => r[0] || null),
        db.select().from(earningsHistory).where(eq(earningsHistory.symbol, symbol)),
        db.select().from(analystRecommendations).where(eq(analystRecommendations.symbol, symbol)),
        db.select().from(upgradeDowngrades).where(eq(upgradeDowngrades.symbol, symbol)).limit(20),
        db.select().from(holdersBreakdown).where(eq(holdersBreakdown.symbol, symbol)).then(r => r[0] || null),
        db.select().from(institutionalHolders).where(eq(institutionalHolders.symbol, symbol)).limit(10),
        db.select().from(insiderTransactions).where(eq(insiderTransactions.symbol, symbol)).limit(10),
      ]);

      return {
        company,
        ratios,
        earnings: earnings.length > 0 ? earnings : null,
        recommendations: recommendations.length > 0 ? recommendations : null,
        upgrades: upgrades.length > 0 ? upgrades : null,
        holders,
        institutionalHolders: instHolders.length > 0 ? instHolders : null,
        insiderTx: insiderTx.length > 0 ? insiderTx : null,
      };
    } catch (error) {
      console.error('Error fetching from database:', error);
      return null;
    }
  }
}

// Singleton instance
export const yahooSyncService = new YahooSyncService();
