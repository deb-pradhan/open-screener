import { Hono } from 'hono';
import { db, isDbConnected } from '../db';
import { 
  tickers,
  latestSnapshot, 
  companyDetails, 
  financialRatios,
  financialStatements,
  dividends,
  stockSplits,
  newsArticles,
  newsTickers,
  dailyPrices,
  earningsHistory,
  analystRecommendations,
  upgradeDowngrades,
  holdersBreakdown,
  institutionalHolders,
  insiderTransactions,
} from '../db/schema';
import { MassiveClient } from '../clients/massive';
import { yahooClient } from '../clients/yahoo';
import { yahooSyncService } from '../services/yahoo-sync';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import type { 
  TickerDetailResponse, 
  FinancialsResponse,
  FinancialStatement,
  StatementType,
  Timeframe,
  DividendWithYield,
  ChartData,
  ChartRange,
  EarningsData,
  AnalystRecommendation,
  UpgradeDowngrade,
  HoldersBreakdown,
  InsiderTransaction,
  InstitutionalHolder,
} from '@screener/shared';

const app = new Hono();
const massiveClient = new MassiveClient();

// Helper to check DB availability
const requireDb = (c: any) => {
  if (!isDbConnected()) {
    return c.json({
      success: false,
      error: 'Database not available',
      timestamp: Date.now(),
    }, 503);
  }
  return null;
};

// ============================================
// Cache Control Helpers
// ============================================
const setCacheHeaders = (c: any, ttlSeconds: number, staleSeconds: number = 0) => {
  if (staleSeconds > 0) {
    c.header('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${staleSeconds}`);
  } else {
    c.header('Cache-Control', `public, max-age=${ttlSeconds}`);
  }
};

// ============================================
// Symbol Validation
// ============================================
const validateSymbol = async (symbol: string): Promise<boolean> => {
  if (!isDbConnected()) return false;
  
  // First check latest_snapshot (faster, most actively traded)
  const [snapshot] = await db.select({ symbol: latestSnapshot.symbol })
    .from(latestSnapshot)
    .where(eq(latestSnapshot.symbol, symbol.toUpperCase()))
    .limit(1);
  
  if (snapshot) return true;
  
  // Fallback to tickers table
  const [ticker] = await db.select({ symbol: tickers.symbol })
    .from(tickers)
    .where(eq(tickers.symbol, symbol.toUpperCase()))
    .limit(1);
  
  return !!ticker;
};

// ============================================
// GET /api/ticker/:symbol
// Returns: Core ticker data for initial page load
// Data Flow: Cache → DB → Yahoo API (with background DB sync)
// ============================================
app.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    // Try DB first if available
    if (isDbConnected()) {
      if (!await validateSymbol(symbol)) {
        // Symbol not in DB, try API fallback (will also trigger background sync)
        return await fetchTickerFromAPI(c, symbol);
      }
      
      // Parallel fetch from DB - including all Yahoo data
      const [
        snapshotResult, 
        companyResult, 
        ratiosResult,
        earningsResult,
        recsResult,
        upgradesResult,
        holdersResult,
        instHoldersResult,
        insiderTxResult,
      ] = await Promise.all([
        db.select().from(latestSnapshot).where(eq(latestSnapshot.symbol, symbol)).limit(1),
        db.select().from(companyDetails).where(eq(companyDetails.symbol, symbol)).limit(1),
        db.select().from(financialRatios).where(eq(financialRatios.symbol, symbol)).limit(1),
        db.select().from(earningsHistory).where(eq(earningsHistory.symbol, symbol)).limit(8),
        db.select().from(analystRecommendations).where(eq(analystRecommendations.symbol, symbol)).limit(4),
        db.select().from(upgradeDowngrades).where(eq(upgradeDowngrades.symbol, symbol)).orderBy(desc(upgradeDowngrades.gradeDate)).limit(20),
        db.select().from(holdersBreakdown).where(eq(holdersBreakdown.symbol, symbol)).limit(1),
        db.select().from(institutionalHolders).where(eq(institutionalHolders.symbol, symbol)).limit(10),
        db.select().from(insiderTransactions).where(eq(insiderTransactions.symbol, symbol)).limit(10),
      ]);
      
      const snapshot = snapshotResult[0] || null;
      const company = companyResult[0] || null;
      const ratios = ratiosResult[0] || null;
      
      // Data freshness metadata
      const freshness = {
        snapshot: snapshot?.updatedAt?.toISOString(),
        ratios: ratios?.lastSyncedAt?.toISOString(),
        company: company?.lastSyncedAt?.toISOString(),
      };
      
      // Check if Yahoo data is stale, trigger background refresh if needed
      const yahooStaleThreshold = 15 * 60 * 1000; // 15 minutes
      const yahooSyncTime = ratios?.yahooSyncedAt?.getTime() || 0;
      const isYahooDataStale = Date.now() - yahooSyncTime > yahooStaleThreshold;
      
      if (isYahooDataStale) {
        // Trigger background Yahoo sync (don't await)
        yahooSyncService.syncSymbol(symbol).catch(err => {
          console.error(`Background Yahoo sync failed for ${symbol}:`, err);
        });
      }
      
      // Also check for Polygon data refresh
      const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
      if (!ratios?.lastSyncedAt || ratios.lastSyncedAt.getTime() < staleThreshold) {
        import('../services/data-sync').then(({ dataSyncService }) => {
          dataSyncService.refreshSymbol(symbol, ['ratios']).catch(console.error);
        }).catch(() => {});
      }
      
      // Set cache headers: 60s cache, 5min stale-while-revalidate
      setCacheHeaders(c, 60, 300);
      
      // Build earnings data
      const earningsData: EarningsData | null = earningsResult.length > 0 ? {
        earningsHistory: earningsResult.map(e => ({
          quarter: e.quarter,
          epsActual: e.epsActual || undefined,
          epsEstimate: e.epsEstimate || undefined,
          epsDifference: e.epsDifference || undefined,
          surprisePercent: e.surprisePercent || undefined,
        })),
      } : null;
      
      // Build recommendations
      const recommendations: AnalystRecommendation[] | null = recsResult.length > 0 
        ? recsResult.map(r => ({
            period: r.period,
            strongBuy: r.strongBuy || 0,
            buy: r.buy || 0,
            hold: r.hold || 0,
            sell: r.sell || 0,
            strongSell: r.strongSell || 0,
          }))
        : null;
      
      // Build upgrade/downgrades
      const upgradeDowngradesList: UpgradeDowngrade[] | null = upgradesResult.length > 0
        ? upgradesResult.map(u => ({
            date: u.gradeDate.toISOString(),
            firm: u.firm,
            toGrade: u.toGrade,
            fromGrade: u.fromGrade || undefined,
            action: u.action,
          }))
        : null;
      
      // Build holders breakdown
      const holdersData: HoldersBreakdown | null = holdersResult[0] ? {
        insidersPercentHeld: holdersResult[0].insidersPercentHeld || undefined,
        institutionsPercentHeld: holdersResult[0].institutionsPercentHeld || undefined,
        institutionsFloatPercentHeld: holdersResult[0].institutionsFloatPercentHeld || undefined,
        institutionsCount: holdersResult[0].institutionsCount || undefined,
      } : null;
      
      // Build institutional holders
      const instHolders: InstitutionalHolder[] | null = instHoldersResult.length > 0
        ? instHoldersResult.map(h => ({
            holder: h.holderName,
            shares: h.shares,
            dateReported: h.dateReported || '',
            pctHeld: h.percentHeld || 0,
            value: h.value || 0,
          }))
        : null;
      
      // Build insider transactions
      const insiderTx: InsiderTransaction[] | null = insiderTxResult.length > 0
        ? insiderTxResult.map(t => ({
            shares: t.shares,
            value: t.value || undefined,
            filerName: t.filerName,
            filerRelation: t.filerRelation || '',
            transactionText: t.transactionText || '',
            startDate: t.transactionDate,
          }))
        : null;
      
      const response: TickerDetailResponse = {
        success: true,
        data: {
          snapshot: snapshot ? {
            symbol: snapshot.symbol,
            name: snapshot.name || undefined,
            logoUrl: snapshot.logoUrl || undefined,
            price: snapshot.price,
            open: snapshot.open || undefined,
            high: snapshot.high || undefined,
            low: snapshot.low || undefined,
            volume: snapshot.volume,
            vwap: snapshot.vwap || undefined,
            changePercent: snapshot.changePercent || undefined,
            rsi14: snapshot.rsi14 || undefined,
            sma20: snapshot.sma20 || undefined,
            sma50: snapshot.sma50 || undefined,
            sma200: snapshot.sma200 || undefined,
            ema12: snapshot.ema12 || undefined,
            ema26: snapshot.ema26 || undefined,
            macdValue: snapshot.macdValue || undefined,
            macdSignal: snapshot.macdSignal || undefined,
            macdHistogram: snapshot.macdHistogram || undefined,
            marketCap: snapshot.marketCap || undefined,
            peRatio: snapshot.peRatio || undefined,
            pbRatio: snapshot.pbRatio || undefined,
            dividendYield: snapshot.dividendYield || undefined,
            grossMargin: snapshot.grossMargin || undefined,
            revenueGrowthYoy: snapshot.revenueGrowthYoy || undefined,
            epsGrowthYoy: snapshot.epsGrowthYoy || undefined,
            debtToEquity: snapshot.debtToEquity || undefined,
            dataDate: snapshot.dataDate || undefined,
            financialsLastSync: snapshot.financialsLastSync?.toISOString(),
            ratiosLastSync: snapshot.ratiosLastSync?.toISOString(),
            updatedAt: snapshot.updatedAt?.toISOString(),
          } : null,
          company: company ? {
            symbol: company.symbol,
            description: company.description || undefined,
            homepageUrl: company.homepageUrl || undefined,
            phoneNumber: company.phoneNumber || undefined,
            address: company.address as any,
            sicCode: company.sicCode || undefined,
            sicDescription: company.sicDescription || undefined,
            industry: company.industry || undefined,
            industryKey: company.industryKey || undefined,
            sector: company.sector || undefined,
            sectorKey: company.sectorKey || undefined,
            totalEmployees: company.totalEmployees || undefined,
            listDate: company.listDate || undefined,
            marketCap: company.marketCap || undefined,
            sharesOutstanding: company.sharesOutstanding || undefined,
            companyOfficers: company.companyOfficers as any,
            auditRisk: company.auditRisk || undefined,
            boardRisk: company.boardRisk || undefined,
            compensationRisk: company.compensationRisk || undefined,
            shareHolderRightsRisk: company.shareholderRightsRisk || undefined,
            overallRisk: company.overallRisk || undefined,
            lastSyncedAt: company.lastSyncedAt?.toISOString(),
          } : null,
          ratios: ratios ? {
            symbol: ratios.symbol,
            peRatio: ratios.peRatio || undefined,
            forwardPE: ratios.forwardPe || undefined,
            pbRatio: ratios.pbRatio || undefined,
            psRatio: ratios.psRatio || undefined,
            evToEbitda: ratios.evToEbitda || undefined,
            evToRevenue: ratios.evToRevenue || undefined,
            pegRatio: ratios.pegRatio || undefined,
            grossMargin: ratios.grossMargin || undefined,
            operatingMargin: ratios.operatingMargin || undefined,
            ebitdaMargin: ratios.ebitdaMargin || undefined,
            netMargin: ratios.netMargin || undefined,
            roe: ratios.roe || undefined,
            roa: ratios.roa || undefined,
            roic: ratios.roic || undefined,
            currentRatio: ratios.currentRatio || undefined,
            quickRatio: ratios.quickRatio || undefined,
            debtToEquity: ratios.debtToEquity || undefined,
            interestCoverage: ratios.interestCoverage || undefined,
            revenueGrowth: ratios.revenueGrowth || undefined,
            earningsGrowth: ratios.earningsGrowth || undefined,
            revenueGrowthQuarterly: ratios.revenueGrowthQuarterly || undefined,
            earningsGrowthQuarterly: ratios.earningsGrowthQuarterly || undefined,
            freeCashFlow: ratios.freeCashFlow || undefined,
            operatingCashFlow: ratios.operatingCashFlow || undefined,
            targetHighPrice: ratios.targetHighPrice || undefined,
            targetLowPrice: ratios.targetLowPrice || undefined,
            targetMeanPrice: ratios.targetMeanPrice || undefined,
            targetMedianPrice: ratios.targetMedianPrice || undefined,
            numberOfAnalysts: ratios.numberOfAnalysts || undefined,
            recommendationKey: ratios.recommendationKey || undefined,
            recommendationMean: ratios.recommendationMean || undefined,
            lastSyncedAt: ratios.lastSyncedAt?.toISOString(),
          } : null,
          earnings: earningsData,
          recommendations,
          upgradeDowngrades: upgradeDowngradesList,
          holdersBreakdown: holdersData,
          insiderTransactions: insiderTx,
          institutionalHolders: instHolders,
        },
        meta: {
          freshness,
          source: 'db',
          staleThresholdMs: 24 * 60 * 60 * 1000,
        },
        timestamp: Date.now(),
      };
      
      return c.json(response);
    }
    
    // No DB available, use API fallback
    return await fetchTickerFromAPI(c, symbol);
  } catch (error) {
    console.error('Error fetching ticker details:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch ticker details',
      timestamp: Date.now(),
    }, 500);
  }
});

// API fallback for ticker details when DB is not available
async function fetchTickerFromAPI(c: any, symbol: string) {
  try {
    // Fetch from multiple sources in parallel:
    // 1. Polygon market snapshot for price data (works with basic plan)
    // 2. Yahoo Finance for company details, ratios, earnings, analysts (free, no API key)
    const [allSnapshots, yahooData] = await Promise.all([
      massiveClient.getMarketSnapshot().catch(() => []),
      yahooClient.getTickerData(symbol),
    ]);
    
    // Find the ticker in Polygon's market snapshot
    const polygonSnapshot = allSnapshots.find(s => s.ticker === symbol);
    const { 
      quote: yahooQuote, 
      profile: yahooProfile, 
      stats: yahooStats,
      earnings: yahooEarnings,
      recommendations: yahooRecs,
      upgradeDowngrades: yahooUpgrades,
      holdersBreakdown: yahooHolders,
      insiderTransactions: yahooInsiders,
      institutionalHolders: yahooInstitutions,
    } = yahooData;
    
    // Need at least one data source
    if (!polygonSnapshot && !yahooQuote) {
      return c.json({
        success: false,
        error: 'Symbol not found',
        timestamp: Date.now(),
      }, 404);
    }
    
    // Merge data from both sources (Polygon for real-time prices, Yahoo for details)
    const dayData = polygonSnapshot 
      ? ((polygonSnapshot.day?.v && polygonSnapshot.day.v > 0) ? polygonSnapshot.day : polygonSnapshot.prevDay)
      : null;
    
    // Prefer Polygon price data (more real-time), fall back to Yahoo
    const price = dayData?.c || yahooQuote?.regularMarketPrice || 0;
    const open = dayData?.o || yahooQuote?.regularMarketOpen;
    const high = dayData?.h || yahooQuote?.regularMarketDayHigh;
    const low = dayData?.l || yahooQuote?.regularMarketDayLow;
    const volume = dayData?.v || yahooQuote?.regularMarketVolume || 0;
    const changePercent = polygonSnapshot?.todaysChangePerc ?? yahooQuote?.regularMarketChangePercent;
    
    // Set shorter cache for API data
    setCacheHeaders(c, 30, 60);
    
    // Build earnings data
    const earnings: EarningsData | null = yahooEarnings ? {
      earningsDate: yahooEarnings.earningsDate?.toISOString(),
      earningsDateStart: yahooEarnings.earningsDateStart?.toISOString(),
      earningsDateEnd: yahooEarnings.earningsDateEnd?.toISOString(),
      isEarningsDateEstimate: yahooEarnings.isEarningsDateEstimate,
      earningsHistory: yahooEarnings.earningsHistory,
      earningsTrend: yahooEarnings.earningsTrend,
    } : null;

    // Build recommendations
    const recommendations: AnalystRecommendation[] | null = yahooRecs || null;

    // Build upgrade/downgrades
    const upgradeDowngrades: UpgradeDowngrade[] | null = yahooUpgrades?.map(u => ({
      date: u.date.toISOString(),
      firm: u.firm,
      toGrade: u.toGrade,
      fromGrade: u.fromGrade,
      action: u.action,
    })) || null;

    // Build holders breakdown
    const holdersBreakdown: HoldersBreakdown | null = yahooHolders || null;

    // Build insider transactions
    const insiderTransactions: InsiderTransaction[] | null = yahooInsiders?.map(t => ({
      shares: t.shares,
      value: t.value,
      filerName: t.filerName,
      filerRelation: t.filerRelation,
      transactionText: t.transactionText,
      startDate: t.startDate.toISOString(),
    })) || null;

    // Build institutional holders
    const institutionalHolders: InstitutionalHolder[] | null = yahooInstitutions?.map(h => ({
      holder: h.holder,
      shares: h.shares,
      dateReported: h.dateReported.toISOString(),
      pctHeld: h.pctHeld,
      value: h.value,
    })) || null;
    
    const response: TickerDetailResponse = {
      success: true,
      data: {
        snapshot: {
          symbol,
          name: yahooQuote?.longName || yahooQuote?.shortName || symbol,
          price,
          open,
          high,
          low,
          volume,
          vwap: dayData?.vw,
          changePercent,
          previousClose: yahooQuote?.regularMarketPreviousClose,
          // 52-week data
          fiftyTwoWeekHigh: yahooQuote?.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: yahooQuote?.fiftyTwoWeekLow,
          fiftyTwoWeekChange: yahooQuote?.fiftyTwoWeekChange ? yahooQuote.fiftyTwoWeekChange * 100 : undefined,
          // Moving averages
          fiftyDayAverage: yahooQuote?.fiftyDayAverage,
          twoHundredDayAverage: yahooQuote?.twoHundredDayAverage,
          // Volume
          averageVolume: yahooQuote?.averageVolume,
          averageVolume10Day: yahooQuote?.averageVolume10Day,
          // Valuation
          marketCap: yahooQuote?.marketCap,
          enterpriseValue: yahooQuote?.enterpriseValue,
          peRatio: yahooQuote?.trailingPE,
          forwardPE: yahooQuote?.forwardPE,
          pbRatio: yahooQuote?.priceToBook,
          psRatio: yahooStats?.priceToSalesTrailing12Months,
          dividendYield: yahooQuote?.dividendYield ? yahooQuote.dividendYield * 100 : undefined,
          beta: yahooQuote?.beta,
          // EPS
          trailingEps: yahooQuote?.trailingEps,
          forwardEps: yahooQuote?.forwardEps,
          // Shares
          sharesOutstanding: yahooQuote?.sharesOutstanding,
          floatShares: yahooQuote?.floatShares,
          sharesShort: yahooQuote?.sharesShort,
          shortRatio: yahooQuote?.shortRatio,
          shortPercentOfFloat: yahooQuote?.shortPercentOfFloat ? yahooQuote.shortPercentOfFloat * 100 : undefined,
          // Cash & Debt
          totalCash: yahooQuote?.totalCash,
          totalCashPerShare: yahooQuote?.totalCashPerShare,
          totalDebt: yahooQuote?.totalDebt,
          bookValue: yahooQuote?.bookValue,
          // Revenue & Income
          totalRevenue: yahooQuote?.totalRevenue,
          revenuePerShare: yahooQuote?.revenuePerShare,
          ebitda: yahooQuote?.ebitda,
          // Margins
          grossMargin: yahooStats?.grossMargins ? yahooStats.grossMargins * 100 : undefined,
          operatingMargin: yahooStats?.operatingMargins ? yahooStats.operatingMargins * 100 : undefined,
          ebitdaMargin: yahooStats?.ebitdaMargins ? yahooStats.ebitdaMargins * 100 : undefined,
          netMargin: yahooStats?.profitMargins ? yahooStats.profitMargins * 100 : undefined,
          // Growth
          revenueGrowthYoy: yahooStats?.revenueGrowth ? yahooStats.revenueGrowth * 100 : undefined,
          epsGrowthYoy: yahooStats?.earningsGrowth ? yahooStats.earningsGrowth * 100 : undefined,
          debtToEquity: yahooStats?.debtToEquity,
          updatedAt: new Date().toISOString(),
        },
        company: yahooProfile ? {
          symbol,
          description: yahooProfile.longBusinessSummary,
          homepageUrl: yahooProfile.website,
          phoneNumber: yahooProfile.phone,
          address: yahooProfile.address1 ? {
            address1: yahooProfile.address1,
            city: yahooProfile.city,
            state: yahooProfile.state,
            postalCode: yahooProfile.zip,
            country: yahooProfile.country,
          } : undefined,
          sicDescription: yahooProfile.industry ? `${yahooProfile.sector} - ${yahooProfile.industry}` : undefined,
          industry: yahooProfile.industry,
          industryKey: yahooProfile.industryKey,
          sector: yahooProfile.sector,
          sectorKey: yahooProfile.sectorKey,
          totalEmployees: yahooProfile.fullTimeEmployees,
          marketCap: yahooQuote?.marketCap,
          companyOfficers: yahooProfile.companyOfficers,
          auditRisk: yahooProfile.auditRisk,
          boardRisk: yahooProfile.boardRisk,
          compensationRisk: yahooProfile.compensationRisk,
          shareHolderRightsRisk: yahooProfile.shareHolderRightsRisk,
          overallRisk: yahooProfile.overallRisk,
        } : null,
        ratios: yahooStats ? {
          symbol,
          peRatio: yahooStats.trailingPE,
          forwardPE: yahooStats.forwardPE,
          pbRatio: yahooStats.priceToBook,
          psRatio: yahooStats.priceToSalesTrailing12Months,
          evToEbitda: yahooStats.enterpriseToEbitda,
          evToRevenue: yahooStats.enterpriseToRevenue,
          pegRatio: yahooStats.pegRatio,
          grossMargin: yahooStats.grossMargins ? yahooStats.grossMargins * 100 : undefined,
          operatingMargin: yahooStats.operatingMargins ? yahooStats.operatingMargins * 100 : undefined,
          ebitdaMargin: yahooStats.ebitdaMargins ? yahooStats.ebitdaMargins * 100 : undefined,
          netMargin: yahooStats.profitMargins ? yahooStats.profitMargins * 100 : undefined,
          roe: yahooStats.returnOnEquity ? yahooStats.returnOnEquity * 100 : undefined,
          roa: yahooStats.returnOnAssets ? yahooStats.returnOnAssets * 100 : undefined,
          currentRatio: yahooStats.currentRatio,
          quickRatio: yahooStats.quickRatio,
          debtToEquity: yahooStats.debtToEquity,
          revenueGrowth: yahooStats.revenueGrowth ? yahooStats.revenueGrowth * 100 : undefined,
          earningsGrowth: yahooStats.earningsGrowth ? yahooStats.earningsGrowth * 100 : undefined,
          revenueGrowthQuarterly: yahooStats.revenueQuarterlyGrowth ? yahooStats.revenueQuarterlyGrowth * 100 : undefined,
          earningsGrowthQuarterly: yahooStats.earningsQuarterlyGrowth ? yahooStats.earningsQuarterlyGrowth * 100 : undefined,
          freeCashFlow: yahooStats.freeCashflow,
          operatingCashFlow: yahooStats.operatingCashflow,
          targetHighPrice: yahooStats.targetHighPrice,
          targetLowPrice: yahooStats.targetLowPrice,
          targetMeanPrice: yahooStats.targetMeanPrice,
          targetMedianPrice: yahooStats.targetMedianPrice,
          numberOfAnalysts: yahooStats.numberOfAnalystOpinions,
          recommendationKey: yahooStats.recommendationKey,
          recommendationMean: yahooStats.recommendationMean,
        } : null,
        earnings,
        recommendations,
        upgradeDowngrades,
        holdersBreakdown,
        insiderTransactions,
        institutionalHolders,
      },
      meta: {
        source: 'api',
        dataSources: {
          price: polygonSnapshot ? 'polygon' : 'yahoo',
          details: yahooProfile ? 'yahoo' : 'none',
          ratios: yahooStats ? 'yahoo' : 'none',
          earnings: yahooEarnings ? 'yahoo' : 'none',
          analysts: yahooRecs ? 'yahoo' : 'none',
        },
        staleThresholdMs: 24 * 60 * 60 * 1000,
      },
      timestamp: Date.now(),
    };
    
    // Trigger background DB sync if database is available
    // This will store the Yahoo data for future requests
    if (isDbConnected() && (yahooQuote || yahooProfile)) {
      yahooSyncService.syncSymbol(symbol).catch(err => {
        console.error(`Background DB sync failed for ${symbol}:`, err);
      });
    }
    
    return c.json(response);
  } catch (error) {
    console.error('API fallback failed:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch ticker data',
      timestamp: Date.now(),
    }, 500);
  }
}

// ============================================
// GET /api/ticker/:symbol/financials
// Query params: timeframe=quarterly|annual, limit=8
// ============================================
app.get('/:symbol/financials', async (c) => {
  const dbError = requireDb(c);
  if (dbError) return dbError;
  
  const symbol = c.req.param('symbol').toUpperCase();
  const timeframe = c.req.query('timeframe') || 'quarterly';
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 20);
  
  if (!await validateSymbol(symbol)) {
    return c.json({ success: false, error: 'Symbol not found', timestamp: Date.now() }, 404);
  }
  
  try {
    const rows = await db.select()
      .from(financialStatements)
      .where(and(
        eq(financialStatements.symbol, symbol),
        eq(financialStatements.timeframe, timeframe)
      ))
      .orderBy(desc(financialStatements.periodEnd))
      .limit(limit * 3); // Get 3x limit since we're grouping by type
    
    // Map DB rows to proper FinancialStatement type
    const statements: FinancialStatement[] = rows.map(row => ({
      id: row.id,
      symbol: row.symbol,
      statementType: row.statementType as StatementType,
      timeframe: row.timeframe as Timeframe,
      fiscalYear: row.fiscalYear,
      fiscalQuarter: row.fiscalQuarter ?? undefined,
      periodEnd: row.periodEnd,
      filingDate: row.filingDate ?? undefined,
      acceptedDate: row.acceptedDate?.toISOString(),
      rawData: row.rawData as Record<string, unknown>,
      revenue: row.revenue ?? undefined,
      netIncome: row.netIncome ?? undefined,
      eps: row.eps ?? undefined,
      totalAssets: row.totalAssets ?? undefined,
      totalLiabilities: row.totalLiabilities ?? undefined,
      operatingCashFlow: row.operatingCashFlow ?? undefined,
    }));
    
    // Group by statement type
    const grouped = {
      income: statements.filter(s => s.statementType === 'income').slice(0, limit),
      balance: statements.filter(s => s.statementType === 'balance').slice(0, limit),
      cashFlow: statements.filter(s => s.statementType === 'cashflow').slice(0, limit),
    };
    
    // 1h cache for financials (rarely changes)
    setCacheHeaders(c, 3600, 7200);
    
    const response: FinancialsResponse = {
      success: true,
      data: grouped,
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error fetching financials:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch financials',
      timestamp: Date.now(),
    }, 500);
  }
});

// ============================================
// GET /api/ticker/:symbol/dividends
// ============================================
app.get('/:symbol/dividends', async (c) => {
  const dbError = requireDb(c);
  if (dbError) return dbError;
  
  const symbol = c.req.param('symbol').toUpperCase();
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  
  try {
    const divs = await db.select()
      .from(dividends)
      .where(eq(dividends.symbol, symbol))
      .orderBy(desc(dividends.exDividendDate))
      .limit(limit);
    
    // Calculate yield from latest snapshot
    const [snap] = await db.select({ price: latestSnapshot.price })
      .from(latestSnapshot)
      .where(eq(latestSnapshot.symbol, symbol));
    
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const annualDividend = divs
      .filter(d => d.exDividendDate >= oneYearAgo)
      .reduce((sum, d) => sum + d.amount, 0);
    
    // 1h cache for dividends
    setCacheHeaders(c, 3600, 7200);
    
    const response: { success: boolean; data: DividendWithYield; timestamp: number } = {
      success: true,
      data: {
        dividends: divs.map(d => ({
          id: d.id,
          symbol: d.symbol,
          exDividendDate: d.exDividendDate,
          payDate: d.payDate || undefined,
          recordDate: d.recordDate || undefined,
          declarationDate: d.declarationDate || undefined,
          amount: d.amount,
          frequency: d.frequency || undefined,
          dividendType: d.dividendType || undefined,
        })),
        trailingYield: snap?.price ? (annualDividend / snap.price) * 100 : undefined,
      },
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error fetching dividends:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch dividends',
      timestamp: Date.now(),
    }, 500);
  }
});

// ============================================
// GET /api/ticker/:symbol/splits
// ============================================
app.get('/:symbol/splits', async (c) => {
  const dbError = requireDb(c);
  if (dbError) return dbError;
  
  const symbol = c.req.param('symbol').toUpperCase();
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  
  try {
    const splits = await db.select()
      .from(stockSplits)
      .where(eq(stockSplits.symbol, symbol))
      .orderBy(desc(stockSplits.executionDate))
      .limit(limit);
    
    // 1h cache for splits
    setCacheHeaders(c, 3600, 7200);
    
    return c.json({
      success: true,
      data: {
        splits: splits.map(s => ({
          id: s.id,
          symbol: s.symbol,
          executionDate: s.executionDate,
          splitFrom: s.splitFrom,
          splitTo: s.splitTo,
        })),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching splits:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch splits',
      timestamp: Date.now(),
    }, 500);
  }
});

// ============================================
// GET /api/ticker/:symbol/news
// ============================================
app.get('/:symbol/news', async (c) => {
  const dbError = requireDb(c);
  if (dbError) return dbError;
  
  const symbol = c.req.param('symbol').toUpperCase();
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  
  try {
    const articles = await db.select({
      id: newsArticles.id,
      title: newsArticles.title,
      publishedAt: newsArticles.publishedAt,
      author: newsArticles.author,
      articleUrl: newsArticles.articleUrl,
      imageUrl: newsArticles.imageUrl,
      description: newsArticles.description,
      publisher: newsArticles.publisher,
    })
    .from(newsArticles)
    .innerJoin(newsTickers, eq(newsArticles.id, newsTickers.articleId))
    .where(eq(newsTickers.symbol, symbol))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit);
    
    // 5min cache for news
    setCacheHeaders(c, 300, 600);
    
    return c.json({
      success: true,
      data: {
        articles: articles.map(a => ({
          id: a.id,
          title: a.title,
          publishedAt: a.publishedAt.toISOString(),
          author: a.author || undefined,
          articleUrl: a.articleUrl || undefined,
          imageUrl: a.imageUrl || undefined,
          description: a.description || undefined,
          publisher: a.publisher as any,
        })),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch news',
      timestamp: Date.now(),
    }, 500);
  }
});

// ============================================
// GET /api/ticker/:symbol/chart
// Query params: range=1D|1W|1M|3M|1Y|5Y|MAX
// ============================================
app.get('/:symbol/chart', async (c) => {
  // Chart can partially work without DB (API fallback), but check anyway for DB routes
  const symbol = c.req.param('symbol').toUpperCase();
  const range = (c.req.query('range') || '1M') as ChartRange;
  
  const rangeConfig: Record<ChartRange, { days: number; timespan: 'minute' | 'hour' | 'day' | 'week' | 'month'; multiplier: number; cacheTtl: number }> = {
    '1D': { days: 1, timespan: 'minute', multiplier: 5, cacheTtl: 60 },
    '1W': { days: 7, timespan: 'hour', multiplier: 1, cacheTtl: 300 },
    '1M': { days: 30, timespan: 'day', multiplier: 1, cacheTtl: 3600 },
    '3M': { days: 90, timespan: 'day', multiplier: 1, cacheTtl: 3600 },
    '1Y': { days: 365, timespan: 'day', multiplier: 1, cacheTtl: 3600 },
    '5Y': { days: 1825, timespan: 'week', multiplier: 1, cacheTtl: 3600 },
    'MAX': { days: 7300, timespan: 'month', multiplier: 1, cacheTtl: 3600 },
  };
  
  const config = rangeConfig[range];
  if (!config) {
    return c.json({ success: false, error: 'Invalid range', timestamp: Date.now() }, 400);
  }
  
  try {
    // Try DB first for daily+ data (only if DB is available)
    if (config.timespan === 'day' && isDbConnected()) {
      const fromDate = new Date(Date.now() - config.days * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      
      const bars = await db.select()
        .from(dailyPrices)
        .where(and(
          eq(dailyPrices.symbol, symbol),
          gte(dailyPrices.date, fromDate)
        ))
        .orderBy(dailyPrices.date);
      
      if (bars.length > 0) {
        setCacheHeaders(c, config.cacheTtl, config.cacheTtl * 2);
        
        const response: { success: boolean; data: ChartData; timestamp: number } = {
          success: true,
          data: {
            bars: bars.map(b => ({
              t: new Date(b.date).getTime(),
              o: b.open,
              h: b.high,
              l: b.low,
              c: b.close,
              v: b.volume,
              vw: b.vwap || undefined,
            })),
            source: 'db',
          },
          timestamp: Date.now(),
        };
        
        return c.json(response);
      }
    }
    
    // Fallback to API
    const fromDate = new Date(Date.now() - config.days * 24 * 60 * 60 * 1000);
    const bars = await massiveClient.getAggregates({
      symbol,
      multiplier: config.multiplier,
      timespan: config.timespan,
      from: fromDate.toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0],
      sort: 'asc',
    });
    
    setCacheHeaders(c, config.cacheTtl, config.cacheTtl * 2);
    
    const response: { success: boolean; data: ChartData; timestamp: number } = {
      success: true,
      data: {
        bars: bars.map(b => ({
          t: b.t,
          o: b.o,
          h: b.h,
          l: b.l,
          c: b.c,
          v: b.v,
          vw: b.vw,
        })),
        source: 'api',
      },
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch chart data',
      timestamp: Date.now(),
    }, 500);
  }
});

export const tickerDetailRouter = app;
