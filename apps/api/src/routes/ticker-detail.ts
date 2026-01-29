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
} from '../db/schema';
import { MassiveClient } from '../clients/massive';
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
// ============================================
app.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!await validateSymbol(symbol)) {
    return c.json({ 
      success: false, 
      error: 'Symbol not found',
      timestamp: Date.now(),
    }, 404);
  }
  
  try {
    // Parallel fetch from DB
    const [snapshotResult, companyResult, ratiosResult] = await Promise.all([
      db.select().from(latestSnapshot).where(eq(latestSnapshot.symbol, symbol)).limit(1),
      db.select().from(companyDetails).where(eq(companyDetails.symbol, symbol)).limit(1),
      db.select().from(financialRatios).where(eq(financialRatios.symbol, symbol)).limit(1),
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
    
    // Check if stale, trigger background refresh if needed
    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
    if (!ratios?.lastSyncedAt || ratios.lastSyncedAt.getTime() < staleThreshold) {
      // Fire-and-forget background refresh
      dataSyncService.refreshSymbol(symbol, ['ratios']).catch(console.error);
    }
    
    // Set cache headers: 60s cache, 5min stale-while-revalidate
    setCacheHeaders(c, 60, 300);
    
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
          totalEmployees: company.totalEmployees || undefined,
          listDate: company.listDate || undefined,
          marketCap: company.marketCap || undefined,
          sharesOutstanding: company.sharesOutstanding || undefined,
          lastSyncedAt: company.lastSyncedAt?.toISOString(),
        } : null,
        ratios: ratios ? {
          symbol: ratios.symbol,
          peRatio: ratios.peRatio || undefined,
          pbRatio: ratios.pbRatio || undefined,
          psRatio: ratios.psRatio || undefined,
          evToEbitda: ratios.evToEbitda || undefined,
          pegRatio: ratios.pegRatio || undefined,
          grossMargin: ratios.grossMargin || undefined,
          operatingMargin: ratios.operatingMargin || undefined,
          netMargin: ratios.netMargin || undefined,
          roe: ratios.roe || undefined,
          roa: ratios.roa || undefined,
          roic: ratios.roic || undefined,
          currentRatio: ratios.currentRatio || undefined,
          quickRatio: ratios.quickRatio || undefined,
          debtToEquity: ratios.debtToEquity || undefined,
          interestCoverage: ratios.interestCoverage || undefined,
          lastSyncedAt: ratios.lastSyncedAt?.toISOString(),
        } : null,
      },
      meta: {
        freshness,
        staleThresholdMs: 24 * 60 * 60 * 1000,
      },
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error fetching ticker details:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch ticker details',
      timestamp: Date.now(),
    }, 500);
  }
});

// ============================================
// GET /api/ticker/:symbol/financials
// Query params: timeframe=quarterly|annual, limit=8
// ============================================
app.get('/:symbol/financials', async (c) => {
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
    // Try DB first for daily+ data
    if (config.timespan === 'day') {
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
