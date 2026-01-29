import YahooFinance from 'yahoo-finance2';
import { redis, REDIS_KEYS, REDIS_TTL } from '../lib/redis';

// Create Yahoo Finance instance (required in v3+)
const yahooFinance = new YahooFinance();

// Helper to convert null to undefined
const nullToUndefined = <T>(val: T | null | undefined): T | undefined => 
  val === null ? undefined : val;

// In-memory cache for when Redis is unavailable
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const MEMORY_CACHE_MAX_SIZE = 500;

function getFromMemoryCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setMemoryCache(key: string, data: unknown, ttlSeconds: number): void {
  // Evict oldest entries if cache is full
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export interface YahooQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekChange?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  averageVolume?: number;
  averageVolume10Day?: number;
  beta?: number;
  // EPS
  trailingEps?: number;
  forwardEps?: number;
  // Shares
  sharesOutstanding?: number;
  floatShares?: number;
  sharesShort?: number;
  shortRatio?: number;
  shortPercentOfFloat?: number;
  // Financials
  totalRevenue?: number;
  revenuePerShare?: number;
  ebitda?: number;
  totalCash?: number;
  totalCashPerShare?: number;
  totalDebt?: number;
  bookValue?: number;
  // Enterprise value
  enterpriseValue?: number;
}

export interface YahooCompanyProfile {
  symbol: string;
  shortName?: string;
  longName?: string;
  longBusinessSummary?: string;
  website?: string;
  industry?: string;
  industryKey?: string;
  sector?: string;
  sectorKey?: string;
  fullTimeEmployees?: number;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  address1?: string;
  zip?: string;
  // Executive officers
  companyOfficers?: Array<{
    name?: string;
    title?: string;
    age?: number;
    totalPay?: number;
  }>;
  auditRisk?: number;
  boardRisk?: number;
  compensationRisk?: number;
  shareHolderRightsRisk?: number;
  overallRisk?: number;
}

export interface YahooKeyStats {
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  priceToSalesTrailing12Months?: number;
  enterpriseToRevenue?: number;
  enterpriseToEbitda?: number;
  pegRatio?: number;
  profitMargins?: number;
  grossMargins?: number;
  operatingMargins?: number;
  ebitdaMargins?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  currentRatio?: number;
  quickRatio?: number;
  debtToEquity?: number;
  // Growth
  revenueGrowth?: number;
  earningsGrowth?: number;
  revenueQuarterlyGrowth?: number;
  earningsQuarterlyGrowth?: number;
  // Per share
  revenuePerShare?: number;
  // Cash flow
  freeCashflow?: number;
  operatingCashflow?: number;
  // Target prices
  targetHighPrice?: number;
  targetLowPrice?: number;
  targetMeanPrice?: number;
  targetMedianPrice?: number;
  numberOfAnalystOpinions?: number;
  recommendationKey?: string;
  recommendationMean?: number;
}

export interface YahooEarnings {
  earningsDate?: Date;
  earningsDateStart?: Date;
  earningsDateEnd?: Date;
  earningsCallDate?: Date;
  isEarningsDateEstimate?: boolean;
  // Historical
  earningsHistory?: Array<{
    quarter: string;
    epsActual?: number;
    epsEstimate?: number;
    epsDifference?: number;
    surprisePercent?: number;
  }>;
  // Trend
  earningsTrend?: Array<{
    period: string; // '0q', '+1q', '0y', '+1y'
    endDate?: string;
    growth?: number;
    earningsEstimate?: {
      avg?: number;
      low?: number;
      high?: number;
      numberOfAnalysts?: number;
    };
    revenueEstimate?: {
      avg?: number;
      low?: number;
      high?: number;
      numberOfAnalysts?: number;
    };
  }>;
}

export interface YahooAnalystRecommendation {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface YahooUpgradeDowngrade {
  date: Date;
  firm: string;
  toGrade: string;
  fromGrade?: string;
  action: string; // 'up', 'down', 'main', 'init', 'reit'
}

export interface YahooInsiderTransaction {
  shares: number;
  value?: number;
  filerName: string;
  filerRelation: string;
  transactionText: string;
  startDate: Date;
}

export interface YahooInstitutionalHolder {
  holder: string;
  shares: number;
  dateReported: Date;
  pctHeld: number;
  value: number;
}

export interface YahooHoldersBreakdown {
  insidersPercentHeld?: number;
  institutionsPercentHeld?: number;
  institutionsFloatPercentHeld?: number;
  institutionsCount?: number;
}

export class YahooClient {
  
  /**
   * Get real-time quote for a symbol
   */
  async getQuote(symbol: string): Promise<YahooQuote | null> {
    try {
      const quote = await yahooFinance.quote(symbol);
      if (!quote) return null;
      
      return {
        symbol: quote.symbol,
        shortName: quote.shortName,
        longName: quote.longName,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketOpen: quote.regularMarketOpen,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,
        regularMarketVolume: quote.regularMarketVolume,
        regularMarketChange: quote.regularMarketChange,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        regularMarketPreviousClose: quote.regularMarketPreviousClose,
        marketCap: quote.marketCap,
        trailingPE: quote.trailingPE,
        forwardPE: quote.forwardPE,
        priceToBook: quote.priceToBook,
        dividendYield: quote.dividendYield,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        fiftyTwoWeekChange: quote.fiftyTwoWeekChange,
        fiftyDayAverage: quote.fiftyDayAverage,
        twoHundredDayAverage: quote.twoHundredDayAverage,
        averageVolume: quote.averageDailyVolume3Month,
        averageVolume10Day: quote.averageDailyVolume10Day,
        beta: (quote as any).beta,
        trailingEps: quote.trailingAnnualDividendYield ? undefined : quote.epsTrailingTwelveMonths,
        forwardEps: quote.epsForward,
        sharesOutstanding: quote.sharesOutstanding,
      };
    } catch (error) {
      console.error(`Yahoo quote failed for ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Get company profile/summary
   */
  async getCompanyProfile(symbol: string): Promise<YahooCompanyProfile | null> {
    try {
      const result = await yahooFinance.quoteSummary(symbol, {
        modules: ['assetProfile', 'price'],
      });
      
      if (!result) return null;
      
      const profile = result.assetProfile;
      const price = result.price;
      
      return {
        symbol,
        shortName: nullToUndefined(price?.shortName),
        longName: nullToUndefined(price?.longName),
        longBusinessSummary: profile?.longBusinessSummary,
        website: profile?.website,
        industry: profile?.industry,
        industryKey: profile?.industryKey,
        sector: profile?.sector,
        sectorKey: profile?.sectorKey,
        fullTimeEmployees: profile?.fullTimeEmployees,
        city: profile?.city,
        state: profile?.state,
        country: profile?.country,
        phone: profile?.phone,
        address1: profile?.address1,
        zip: profile?.zip,
        companyOfficers: profile?.companyOfficers?.slice(0, 5).map(o => ({
          name: o.name,
          title: o.title,
          age: o.age,
          totalPay: o.totalPay,
        })),
        auditRisk: profile?.auditRisk,
        boardRisk: profile?.boardRisk,
        compensationRisk: profile?.compensationRisk,
        shareHolderRightsRisk: profile?.shareHolderRightsRisk,
        overallRisk: profile?.overallRisk,
      };
    } catch (error) {
      console.error(`Yahoo profile failed for ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Get key financial statistics
   */
  async getKeyStats(symbol: string): Promise<YahooKeyStats | null> {
    try {
      const result = await yahooFinance.quoteSummary(symbol, {
        modules: ['defaultKeyStatistics', 'financialData'],
      });
      
      if (!result) return null;
      
      const stats = result.defaultKeyStatistics;
      const financials = result.financialData;
      
      return {
        trailingPE: nullToUndefined(stats?.trailingPE) as number | undefined,
        forwardPE: nullToUndefined(stats?.forwardPE) as number | undefined,
        priceToBook: nullToUndefined(stats?.priceToBook) as number | undefined,
        priceToSalesTrailing12Months: nullToUndefined(stats?.priceToSalesTrailing12Months) as number | undefined,
        enterpriseToRevenue: nullToUndefined(stats?.enterpriseToRevenue) as number | undefined,
        enterpriseToEbitda: nullToUndefined(stats?.enterpriseToEbitda) as number | undefined,
        pegRatio: nullToUndefined(stats?.pegRatio) as number | undefined,
        profitMargins: financials?.profitMargins,
        grossMargins: financials?.grossMargins,
        operatingMargins: financials?.operatingMargins,
        ebitdaMargins: financials?.ebitdaMargins,
        returnOnEquity: financials?.returnOnEquity,
        returnOnAssets: financials?.returnOnAssets,
        currentRatio: financials?.currentRatio,
        quickRatio: financials?.quickRatio,
        debtToEquity: financials?.debtToEquity,
        revenueGrowth: financials?.revenueGrowth,
        earningsGrowth: financials?.earningsGrowth,
        revenueQuarterlyGrowth: nullToUndefined(financials?.revenueQuarterlyGrowth) as number | undefined,
        earningsQuarterlyGrowth: nullToUndefined(financials?.earningsQuarterlyGrowth) as number | undefined,
        revenuePerShare: financials?.revenuePerShare,
        freeCashflow: financials?.freeCashflow,
        operatingCashflow: financials?.operatingCashflow,
        targetHighPrice: financials?.targetHighPrice,
        targetLowPrice: financials?.targetLowPrice,
        targetMeanPrice: financials?.targetMeanPrice,
        targetMedianPrice: financials?.targetMedianPrice,
        numberOfAnalystOpinions: financials?.numberOfAnalystOpinions,
        recommendationKey: financials?.recommendationKey,
        recommendationMean: financials?.recommendationMean,
      };
    } catch (error) {
      console.error(`Yahoo stats failed for ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Get comprehensive ticker data in one call - fetches ALL available modules
   * Uses Redis caching with fallback to in-memory cache
   */
  async getTickerData(symbol: string, options?: { skipCache?: boolean }): Promise<{
    quote: YahooQuote | null;
    profile: YahooCompanyProfile | null;
    stats: YahooKeyStats | null;
    earnings: YahooEarnings | null;
    recommendations: YahooAnalystRecommendation[] | null;
    upgradeDowngrades: YahooUpgradeDowngrade[] | null;
    holdersBreakdown: YahooHoldersBreakdown | null;
    insiderTransactions: YahooInsiderTransaction[] | null;
    institutionalHolders: YahooInstitutionalHolder[] | null;
    _fromCache?: boolean;
  }> {
    const cacheKey = `${REDIS_KEYS.YAHOO_TICKER}${symbol}`;
    
    // Try cache first (unless skipCache is true)
    if (!options?.skipCache) {
      try {
        // Try Redis first
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return { ...parsed, _fromCache: true };
        }
        
        // Fallback to in-memory cache
        const memoryCached = getFromMemoryCache<typeof this.getTickerData extends (...args: any) => Promise<infer R> ? R : never>(cacheKey);
        if (memoryCached) {
          return { ...memoryCached, _fromCache: true };
        }
      } catch (e) {
        // Cache read failed, continue to API
      }
    }
    
    try {
      const result = await yahooFinance.quoteSummary(symbol, {
        modules: [
          'price',
          'summaryDetail',
          'assetProfile',
          'defaultKeyStatistics',
          'financialData',
          'calendarEvents',
          'earnings',
          'earningsHistory',
          'earningsTrend',
          'recommendationTrend',
          'upgradeDowngradeHistory',
          'majorHoldersBreakdown',
          'insiderTransactions',
          'institutionOwnership',
        ],
      });
      
      if (!result) {
        return { 
          quote: null, profile: null, stats: null, earnings: null,
          recommendations: null, upgradeDowngrades: null, holdersBreakdown: null,
          insiderTransactions: null, institutionalHolders: null,
        };
      }
      
      const price = result.price;
      const summary = result.summaryDetail;
      const profile = result.assetProfile;
      const stats = result.defaultKeyStatistics;
      const financials = result.financialData;
      const calendar = result.calendarEvents;
      const earningsData = result.earnings;
      const earningsHistory = result.earningsHistory;
      const earningsTrend = result.earningsTrend;
      const recTrend = result.recommendationTrend;
      const upgrades = result.upgradeDowngradeHistory;
      const holders = result.majorHoldersBreakdown;
      const insiderTx = result.insiderTransactions;
      const instOwners = result.institutionOwnership;
      
      // Build quote with all available data
      const quote: YahooQuote | null = price ? {
        symbol,
        shortName: nullToUndefined(price.shortName),
        longName: nullToUndefined(price.longName),
        regularMarketPrice: price.regularMarketPrice,
        regularMarketOpen: price.regularMarketOpen,
        regularMarketDayHigh: price.regularMarketDayHigh,
        regularMarketDayLow: price.regularMarketDayLow,
        regularMarketVolume: price.regularMarketVolume,
        regularMarketChange: price.regularMarketChange,
        regularMarketChangePercent: price.regularMarketChangePercent,
        regularMarketPreviousClose: price.regularMarketPreviousClose,
        marketCap: price.marketCap,
        trailingPE: summary?.trailingPE,
        forwardPE: summary?.forwardPE,
        priceToBook: (summary?.priceToBook as number | undefined),
        dividendYield: summary?.dividendYield,
        fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: summary?.fiftyTwoWeekLow,
        fiftyTwoWeekChange: (stats?.['52WeekChange'] as number | undefined),
        fiftyDayAverage: summary?.fiftyDayAverage,
        twoHundredDayAverage: summary?.twoHundredDayAverage,
        averageVolume: summary?.averageVolume,
        averageVolume10Day: summary?.averageVolume10days,
        beta: summary?.beta,
        trailingEps: earningsData?.earningsChart?.quarterly 
          ? earningsData.earningsChart.quarterly.reduce((sum, q) => sum + (q.actual ?? 0), 0)
          : (stats?.trailingEps as number | undefined),
        forwardEps: (stats?.forwardEps as number | undefined),
        sharesOutstanding: stats?.sharesOutstanding,
        floatShares: stats?.floatShares,
        sharesShort: stats?.sharesShort,
        shortRatio: stats?.shortRatio,
        shortPercentOfFloat: stats?.shortPercentOfFloat,
        totalRevenue: financials?.totalRevenue,
        revenuePerShare: financials?.revenuePerShare,
        ebitda: financials?.ebitda,
        totalCash: financials?.totalCash,
        totalCashPerShare: financials?.totalCashPerShare,
        totalDebt: financials?.totalDebt,
        bookValue: (stats?.bookValue as number | undefined),
        enterpriseValue: stats?.enterpriseValue,
      } : null;

      // Build profile
      const companyProfile: YahooCompanyProfile | null = profile ? {
        symbol,
        shortName: nullToUndefined(price?.shortName),
        longName: nullToUndefined(price?.longName),
        longBusinessSummary: profile.longBusinessSummary,
        website: profile.website,
        industry: profile.industry,
        industryKey: profile.industryKey,
        sector: profile.sector,
        sectorKey: profile.sectorKey,
        fullTimeEmployees: profile.fullTimeEmployees,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        phone: profile.phone,
        address1: profile.address1,
        zip: profile.zip,
        companyOfficers: profile.companyOfficers?.slice(0, 5).map(o => ({
          name: o.name,
          title: o.title,
          age: o.age,
          totalPay: o.totalPay,
        })),
        auditRisk: profile.auditRisk,
        boardRisk: profile.boardRisk,
        compensationRisk: profile.compensationRisk,
        shareHolderRightsRisk: profile.shareHolderRightsRisk,
        overallRisk: profile.overallRisk,
      } : null;

      // Build stats
      const keyStats: YahooKeyStats = {
        trailingPE: nullToUndefined(stats?.trailingPE) as number | undefined,
        forwardPE: nullToUndefined(stats?.forwardPE) as number | undefined,
        priceToBook: nullToUndefined(stats?.priceToBook) as number | undefined,
        priceToSalesTrailing12Months: nullToUndefined(stats?.priceToSalesTrailing12Months) as number | undefined,
        enterpriseToRevenue: nullToUndefined(stats?.enterpriseToRevenue) as number | undefined,
        enterpriseToEbitda: nullToUndefined(stats?.enterpriseToEbitda) as number | undefined,
        pegRatio: nullToUndefined(stats?.pegRatio) as number | undefined,
        profitMargins: financials?.profitMargins,
        grossMargins: financials?.grossMargins,
        operatingMargins: financials?.operatingMargins,
        ebitdaMargins: financials?.ebitdaMargins,
        returnOnEquity: financials?.returnOnEquity,
        returnOnAssets: financials?.returnOnAssets,
        currentRatio: financials?.currentRatio,
        quickRatio: financials?.quickRatio,
        debtToEquity: financials?.debtToEquity,
        revenueGrowth: financials?.revenueGrowth,
        earningsGrowth: financials?.earningsGrowth,
        revenueQuarterlyGrowth: nullToUndefined(financials?.revenueQuarterlyGrowth) as number | undefined,
        earningsQuarterlyGrowth: nullToUndefined(financials?.earningsQuarterlyGrowth) as number | undefined,
        revenuePerShare: financials?.revenuePerShare,
        freeCashflow: financials?.freeCashflow,
        operatingCashflow: financials?.operatingCashflow,
        targetHighPrice: financials?.targetHighPrice,
        targetLowPrice: financials?.targetLowPrice,
        targetMeanPrice: financials?.targetMeanPrice,
        targetMedianPrice: financials?.targetMedianPrice,
        numberOfAnalystOpinions: financials?.numberOfAnalystOpinions,
        recommendationKey: financials?.recommendationKey,
        recommendationMean: financials?.recommendationMean,
      };

      // Build earnings info
      const earnings: YahooEarnings | null = calendar || earningsHistory || earningsTrend ? {
        earningsDate: calendar?.earnings?.earningsDate?.[0],
        earningsDateStart: calendar?.earnings?.earningsDate?.[0],
        earningsDateEnd: calendar?.earnings?.earningsDate?.[1] || calendar?.earnings?.earningsDate?.[0],
        isEarningsDateEstimate: calendar?.earnings?.isEarningsDateEstimate,
        earningsHistory: earningsHistory?.history?.map(h => ({
          quarter: `${h.quarter}`,
          epsActual: nullToUndefined(h.epsActual),
          epsEstimate: nullToUndefined(h.epsEstimate),
          epsDifference: nullToUndefined(h.epsDifference),
          surprisePercent: nullToUndefined(h.surprisePercent),
        })),
        earningsTrend: earningsTrend?.trend?.map(t => ({
          period: t.period ?? '',
          endDate: t.endDate ? (t.endDate instanceof Date ? t.endDate.toISOString() : String(t.endDate)) : undefined,
          growth: nullToUndefined(t.growth),
          earningsEstimate: t.earningsEstimate ? {
            avg: nullToUndefined(t.earningsEstimate.avg),
            low: nullToUndefined(t.earningsEstimate.low),
            high: nullToUndefined(t.earningsEstimate.high),
            numberOfAnalysts: nullToUndefined(t.earningsEstimate.numberOfAnalysts),
          } : undefined,
          revenueEstimate: t.revenueEstimate ? {
            avg: nullToUndefined(t.revenueEstimate.avg),
            low: nullToUndefined(t.revenueEstimate.low),
            high: nullToUndefined(t.revenueEstimate.high),
            numberOfAnalysts: nullToUndefined(t.revenueEstimate.numberOfAnalysts),
          } : undefined,
        })),
      } : null;

      // Build recommendations
      const recommendations: YahooAnalystRecommendation[] | null = recTrend?.trend?.map(t => ({
        period: t.period ?? '',
        strongBuy: t.strongBuy ?? 0,
        buy: t.buy ?? 0,
        hold: t.hold ?? 0,
        sell: t.sell ?? 0,
        strongSell: t.strongSell ?? 0,
      })) || null;

      // Build upgrade/downgrades
      const upgradeDowngrades: YahooUpgradeDowngrade[] | null = upgrades?.history?.slice(0, 20).map(u => ({
        date: u.epochGradeDate && typeof u.epochGradeDate === 'number' 
          ? new Date(u.epochGradeDate * 1000) 
          : new Date(),
        firm: u.firm ?? '',
        toGrade: u.toGrade ?? '',
        fromGrade: u.fromGrade,
        action: u.action ?? '',
      })) || null;

      // Build holders breakdown
      const holdersBreakdown: YahooHoldersBreakdown | null = holders ? {
        insidersPercentHeld: holders.insidersPercentHeld,
        institutionsPercentHeld: holders.institutionsPercentHeld,
        institutionsFloatPercentHeld: holders.institutionsFloatPercentHeld,
        institutionsCount: holders.institutionsCount,
      } : null;

      // Build insider transactions
      const insiderTransactions: YahooInsiderTransaction[] | null = insiderTx?.transactions?.slice(0, 10).map(t => ({
        shares: t.shares ?? 0,
        value: t.value,
        filerName: t.filerName ?? '',
        filerRelation: t.filerRelation ?? '',
        transactionText: t.transactionText ?? '',
        startDate: t.startDate ?? new Date(),
      })) || null;

      // Build institutional holders
      const institutionalHolders: YahooInstitutionalHolder[] | null = instOwners?.ownershipList?.slice(0, 10).map(o => ({
        holder: o.organization ?? '',
        shares: o.position ?? 0,
        dateReported: o.reportDate ?? new Date(),
        pctHeld: o.pctHeld ?? 0,
        value: o.value ?? 0,
      })) || null;

      const responseData = {
        quote,
        profile: companyProfile,
        stats: keyStats,
        earnings,
        recommendations,
        upgradeDowngrades,
        holdersBreakdown,
        insiderTransactions,
        institutionalHolders,
      };

      // Cache the result
      try {
        const cacheData = JSON.stringify(responseData);
        // Save to Redis
        await redis.setex(cacheKey, REDIS_TTL.YAHOO_TICKER_FULL, cacheData);
        // Also save to memory cache as backup
        setMemoryCache(cacheKey, responseData, REDIS_TTL.YAHOO_TICKER_FULL);
      } catch (e) {
        // Cache write failed, continue anyway
      }

      return responseData;
    } catch (error) {
      console.error(`Yahoo data failed for ${symbol}:`, error instanceof Error ? error.message : error);
      return { 
        quote: null, profile: null, stats: null, earnings: null,
        recommendations: null, upgradeDowngrades: null, holdersBreakdown: null,
        insiderTransactions: null, institutionalHolders: null,
      };
    }
  }

  /**
   * Invalidate cache for a symbol
   */
  async invalidateCache(symbol: string): Promise<void> {
    const cacheKey = `${REDIS_KEYS.YAHOO_TICKER}${symbol}`;
    try {
      await redis.del(cacheKey);
      memoryCache.delete(cacheKey);
    } catch (e) {
      // Ignore cache errors
    }
  }
}

// Singleton instance
export const yahooClient = new YahooClient();
