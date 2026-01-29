import { redis, REDIS_KEYS, REDIS_TTL } from '../lib/redis';
import { db } from '../db';
import { latestSnapshot } from '../db/schema';
import { MassiveClient } from '../clients/massive';
import { desc, asc, gt, gte, lt, lte, eq, and, sql } from 'drizzle-orm';
import type { 
  ScreenerFilter, 
  ScreenerResult, 
  StockIndicators,
  FilterCondition,
  FilterOperator 
} from '@screener/shared';

// Fields that require indicator API calls
const INDICATOR_FIELDS = ['rsi14', 'sma20', 'sma50', 'sma200', 'ema12', 'ema26', 'macd'] as const;
// Fields available from snapshot
const BASIC_FIELDS = ['price', 'volume', 'changePercent'] as const;

export class ScreenerService {
  private massiveClient: MassiveClient;
  private snapshotCache: StockIndicators[] = [];
  private lastFetchTime: number = 0;
  private cacheTTL = 60000; // 1 minute in-memory cache
  private indicatorCache: Map<string, Partial<StockIndicators>> = new Map();
  private indicatorCacheTime: Map<string, number> = new Map();
  private indicatorCacheTTL = 300000; // 5 minute indicator cache
  private tickerDetailsCache: Map<string, { logo?: string; name?: string }> = new Map();
  private useDatabase: boolean;

  constructor() {
    this.massiveClient = new MassiveClient();
    // Use database if DATABASE_URL is set
    this.useDatabase = !!process.env.DATABASE_URL;
    
    if (this.useDatabase) {
      console.log('ScreenerService: Using PostgreSQL for queries');
    } else {
      console.log('ScreenerService: Using API-only mode (no database)');
    }
  }

  // Disable database after connection failure
  private disableDatabase() {
    if (this.useDatabase) {
      console.log('ScreenerService: Disabling database queries after connection failure');
      this.useDatabase = false;
    }
  }

  // ============================================
  // Database-powered screener (preferred)
  // ============================================
  
  async runScreenerFromDB(
    filter: ScreenerFilter,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ScreenerResult> {
    // Build WHERE conditions from filter
    const conditions = this.buildDBConditions(filter.conditions);
    
    // Apply special preset logic
    const presetConditions = this.getPresetDBConditions(filter.id);
    const allConditions = [...conditions, ...presetConditions].filter(Boolean);
    
    // Query with filters
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;
    
    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(latestSnapshot)
      .where(whereClause);
    
    const total = Number(countResult?.count || 0);
    
    // Get paginated results
    const sortColumn = this.getDBSortColumn(filter.sortBy || 'volume');
    const sortOrder = filter.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    
    const rows = await db
      .select()
      .from(latestSnapshot)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    
    // Map to StockIndicators format
    const stocks: StockIndicators[] = rows.map(row => ({
      symbol: row.symbol,
      name: row.name || undefined,
      logo: row.logoUrl || undefined,
      price: row.price,
      volume: row.volume,
      changePercent: row.changePercent || 0,
      // Technical Indicators
      rsi14: row.rsi14 || undefined,
      sma20: row.sma20 || undefined,
      sma50: row.sma50 || undefined,
      sma200: row.sma200 || undefined,
      ema12: row.ema12 || undefined,
      ema26: row.ema26 || undefined,
      macd: row.macdValue ? {
        value: row.macdValue,
        signal: row.macdSignal || 0,
        histogram: row.macdHistogram || 0,
      } : undefined,
      // Fundamental Fields
      marketCap: row.marketCap || undefined,
      peRatio: row.peRatio || undefined,
      pbRatio: row.pbRatio || undefined,
      dividendYield: row.dividendYield || undefined,
      grossMargin: row.grossMargin || undefined,
      debtToEquity: row.debtToEquity || undefined,
      revenueGrowthYoy: row.revenueGrowthYoy || undefined,
      epsGrowthYoy: row.epsGrowthYoy || undefined,
      // Metadata
      financialsLastSync: row.financialsLastSync?.toISOString(),
      ratiosLastSync: row.ratiosLastSync?.toISOString(),
      updatedAt: row.updatedAt?.getTime() || Date.now(),
    }));
    
    return {
      stocks,
      total,
      page,
      pageSize,
      filterId: filter.id,
      timestamp: Date.now(),
    };
  }

  private buildDBConditions(conditions: FilterCondition[]) {
    return conditions.map(condition => {
      const column = this.getDBColumn(condition.field);
      if (!column) return null;
      
      const value = condition.value;
      
      switch (condition.operator) {
        case 'gt': return gt(column, value as number);
        case 'gte': return gte(column, value as number);
        case 'lt': return lt(column, value as number);
        case 'lte': return lte(column, value as number);
        case 'eq': return eq(column, value as number);
        case 'between': {
          const [min, max] = value as [number, number];
          return and(gte(column, min), lte(column, max));
        }
        default: return null;
      }
    }).filter(Boolean);
  }

  private getDBColumn(field: string) {
    const columnMap: Record<string, any> = {
      // Price & Volume
      price: latestSnapshot.price,
      volume: latestSnapshot.volume,
      changePercent: latestSnapshot.changePercent,
      // Technical Indicators
      rsi14: latestSnapshot.rsi14,
      sma20: latestSnapshot.sma20,
      sma50: latestSnapshot.sma50,
      sma200: latestSnapshot.sma200,
      ema12: latestSnapshot.ema12,
      ema26: latestSnapshot.ema26,
      // Fundamental Fields
      marketCap: latestSnapshot.marketCap,
      peRatio: latestSnapshot.peRatio,
      pbRatio: latestSnapshot.pbRatio,
      dividendYield: latestSnapshot.dividendYield,
      grossMargin: latestSnapshot.grossMargin,
      debtToEquity: latestSnapshot.debtToEquity,
      revenueGrowthYoy: latestSnapshot.revenueGrowthYoy,
      epsGrowthYoy: latestSnapshot.epsGrowthYoy,
    };
    return columnMap[field];
  }

  private getDBSortColumn(field: string) {
    return this.getDBColumn(field) || latestSnapshot.volume;
  }

  private getPresetDBConditions(presetId: string): any[] {
    switch (presetId) {
      case 'goldenCross':
        // Price > SMA50 > SMA200
        return [
          sql`${latestSnapshot.price} > ${latestSnapshot.sma50}`,
          sql`${latestSnapshot.sma50} > ${latestSnapshot.sma200}`,
        ];
      case 'deathCross':
        return [
          sql`${latestSnapshot.price} < ${latestSnapshot.sma50}`,
          sql`${latestSnapshot.sma50} < ${latestSnapshot.sma200}`,
        ];
      case 'aboveSma200':
        return [sql`${latestSnapshot.price} > ${latestSnapshot.sma200}`];
      case 'belowSma200':
        return [sql`${latestSnapshot.price} < ${latestSnapshot.sma200}`];
      case 'emaCrossover':
        return [sql`${latestSnapshot.ema12} > ${latestSnapshot.ema26}`];
      case 'uptrend':
        return [
          sql`${latestSnapshot.price} > ${latestSnapshot.sma50}`,
          sql`${latestSnapshot.price} > ${latestSnapshot.sma200}`,
        ];
      case 'downtrend':
        return [
          sql`${latestSnapshot.price} < ${latestSnapshot.sma50}`,
          sql`${latestSnapshot.price} < ${latestSnapshot.sma200}`,
        ];
      default:
        return [];
    }
  }

  // Run screener with given filter
  async runScreener(
    filter: ScreenerFilter,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ScreenerResult> {
    // Try to get cached results first
    const cacheKey = `${REDIS_KEYS.SCREENER_RESULTS}${filter.id}:${page}:${pageSize}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis might not be connected, continue without cache
    }

    // Use database if available (much faster, pre-computed indicators)
    if (this.useDatabase) {
      try {
        const result = await this.runScreenerFromDB(filter, page, pageSize);
        
        // If database returned 0 results and this preset needs indicators,
        // fall back to API mode (indicators might not be synced yet)
        if (result.total === 0 && this.presetNeedsIndicators(filter.id)) {
          console.log(`Preset ${filter.id} returned 0 results from DB, falling back to API...`);
          return this.runScreenerFromAPI(filter, page, pageSize, cacheKey);
        }
        
        // Cache results
        try {
          await redis.setex(cacheKey, REDIS_TTL.SCREENER_RESULTS, JSON.stringify(result));
        } catch { /* ignore */ }
        
        return result;
      } catch (dbError) {
        console.error('Database query failed, falling back to API:', dbError);
        // Disable database for future requests to avoid repeated failures
        this.disableDatabase();
        // Fall through to API-based screener
      }
    }

    // Fallback: API-based screener (slower, on-demand)
    return this.runScreenerFromAPI(filter, page, pageSize, cacheKey);
  }

  // Original API-based screener (fallback when no database)
  private async runScreenerFromAPI(
    filter: ScreenerFilter,
    page: number,
    pageSize: number,
    cacheKey: string
  ): Promise<ScreenerResult> {
    // Separate conditions into basic (snapshot) and indicator-based
    const basicConditions = filter.conditions.filter(c => 
      (BASIC_FIELDS as readonly string[]).includes(c.field)
    );
    const indicatorConditions = filter.conditions.filter(c => 
      (INDICATOR_FIELDS as readonly string[]).includes(c.field)
    );

    // Get all stocks from snapshot
    const allStocks = await this.getAllIndicators();
    
    // First pass: filter by basic conditions (price, volume, change)
    let filtered = allStocks.filter((stock) => 
      this.matchesFilter(stock, basicConditions)
    );

    console.log(`After basic filter: ${filtered.length} stocks (from ${allStocks.length})`);

    // Check if this preset needs indicator data (either explicit conditions or special logic)
    const needsIndicators = indicatorConditions.length > 0 || this.presetNeedsIndicators(filter.id);
    
    if (needsIndicators) {
      // Sort by volume to prioritize liquid stocks, take top candidates
      // Use smaller limit to avoid API timeouts and rate limits
      const maxCandidates = 100; // Reduced from 500 to improve API response time
      filtered = this.sortStocks(filtered, 'volume', 'desc').slice(0, maxCandidates);
      
      console.log(`Fetching indicators for ${filtered.length} candidates (API fallback mode)...`);
      
      try {
        // Fetch indicators for candidates
        filtered = await this.enrichStocksWithIndicators(filtered);
        
        // Second pass: filter by indicator conditions
        if (indicatorConditions.length > 0) {
          filtered = filtered.filter((stock) => 
            this.matchesFilter(stock, indicatorConditions)
          );
        }
        
        // Apply special preset logic (price vs SMA comparisons, etc.)
        filtered = this.applyPresetLogic(filter.id, filtered);
        
        console.log(`After indicator filter: ${filtered.length} stocks`);
      } catch (indicatorError) {
        console.error('Failed to fetch indicators:', indicatorError);
        // Return filtered results without indicator data rather than failing
        console.log('Returning results without indicator filtering');
      }
    }

    // Final sort
    const sortField = filter.sortBy || 'volume';
    const sortOrder = filter.sortOrder || 'desc';
    filtered = this.sortStocks(filtered, sortField, sortOrder);

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    let stocks = filtered.slice(start, start + pageSize);

    // Ensure all page stocks have indicators and details
    stocks = await this.enrichStocksWithIndicators(stocks);

    const result: ScreenerResult = {
      stocks,
      total,
      page,
      pageSize,
      filterId: filter.id,
      timestamp: Date.now(),
    };

    // Cache results briefly
    try {
      await redis.setex(cacheKey, REDIS_TTL.SCREENER_RESULTS, JSON.stringify(result));
    } catch {
      // Ignore cache errors
    }

    return result;
  }

  // Check if indicator cache is still valid
  private isIndicatorCacheValid(symbol: string): boolean {
    const cacheTime = this.indicatorCacheTime.get(symbol);
    if (!cacheTime) return false;
    return Date.now() - cacheTime < this.indicatorCacheTTL;
  }

  // Enrich stocks with indicators and logos
  private async enrichStocksWithIndicators(stocks: StockIndicators[]): Promise<StockIndicators[]> {
    // Process in batches to avoid overwhelming the API
    const batchSize = 20;
    const enriched: StockIndicators[] = [];

    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          // Check if stock already has indicators
          if (stock.rsi14 !== undefined && stock.sma200 !== undefined) {
            // Already enriched, just fetch details if needed
            if (!stock.logo && !stock.name) {
              const cachedDetails = this.tickerDetailsCache.get(stock.symbol);
              if (cachedDetails) {
                return { ...stock, logo: cachedDetails.logo, name: cachedDetails.name || stock.symbol };
              }
              const apiDetails = await this.massiveClient.getTickerDetails(stock.symbol).catch(() => null);
              if (apiDetails) {
                const logo = apiDetails.branding?.logo_url;
                const name = apiDetails.name;
                this.tickerDetailsCache.set(stock.symbol, { logo, name });
                return { ...stock, logo, name: name || stock.symbol };
              }
            }
            return stock;
          }

          // Check indicator cache
          const cachedIndicators = this.indicatorCache.get(stock.symbol);
          const cachedDetails = this.tickerDetailsCache.get(stock.symbol);
          
          if (cachedIndicators && this.isIndicatorCacheValid(stock.symbol)) {
            return { 
              ...stock, 
              ...cachedIndicators, 
              logo: cachedDetails?.logo, 
              name: cachedDetails?.name || stock.symbol 
            };
          }

          // Fetch fresh indicators and details in parallel
          try {
            const [rsi, sma20, sma50, sma200, ema12, ema26, details] = await Promise.all([
              this.massiveClient.getRSI(stock.symbol, 14).catch(() => null),
              this.massiveClient.getSMA(stock.symbol, 20).catch(() => null),
              this.massiveClient.getSMA(stock.symbol, 50).catch(() => null),
              this.massiveClient.getSMA(stock.symbol, 200).catch(() => null),
              this.massiveClient.getEMA(stock.symbol, 12).catch(() => null),
              this.massiveClient.getEMA(stock.symbol, 26).catch(() => null),
              cachedDetails ? Promise.resolve(cachedDetails) : 
                this.massiveClient.getTickerDetails(stock.symbol).catch(() => null),
            ]);

            const indicators: Partial<StockIndicators> = {
              rsi14: rsi?.value,
              sma20: sma20?.value,
              sma50: sma50?.value,
              sma200: sma200?.value,
              ema12: ema12?.value,
              ema26: ema26?.value,
            };

            // Cache the results
            this.indicatorCache.set(stock.symbol, indicators);
            this.indicatorCacheTime.set(stock.symbol, Date.now());
            
            let logo: string | undefined;
            let name: string | undefined;
            
            if (details && 'branding' in details) {
              logo = details.branding?.logo_url;
              name = details.name;
              this.tickerDetailsCache.set(stock.symbol, { logo, name });
            } else if (details) {
              logo = (details as { logo?: string }).logo;
              name = (details as { name?: string }).name;
            }

            return {
              ...stock,
              ...indicators,
              logo,
              name: name || stock.symbol,
            };
          } catch (error) {
            console.error(`Failed to fetch indicators for ${stock.symbol}:`, error);
            return stock;
          }
        })
      );

      enriched.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return enriched;
  }

  // Get all indicators - from Redis, memory cache, or fresh fetch
  private async getAllIndicators(): Promise<StockIndicators[]> {
    // Try Redis first
    const redisData = await this.getAllIndicatorsFromCache();
    if (redisData.length > 0) {
      return redisData;
    }

    // Try in-memory cache
    if (this.snapshotCache.length > 0 && Date.now() - this.lastFetchTime < this.cacheTTL) {
      return this.snapshotCache;
    }

    // Fetch fresh data from Massive API
    console.log('Fetching fresh market snapshot from Massive API...');
    try {
      const snapshots = await this.massiveClient.getMarketSnapshot();
      
      if (!snapshots || snapshots.length === 0) {
        console.log('No snapshot data received');
        return this.snapshotCache; // Return stale cache if available
      }

      console.log(`Received ${snapshots.length} tickers from API`);

      // Convert snapshots to indicators
      // Use prevDay data if current day has no trading (pre-market, after-hours)
      this.snapshotCache = snapshots
        .filter(s => s.ticker && (s.day || s.prevDay))
        .map(snapshot => {
          const hasCurrentDay = snapshot.day && snapshot.day.v > 0;
          const dayData = hasCurrentDay ? snapshot.day : snapshot.prevDay;
          
          return {
            symbol: snapshot.ticker,
            price: dayData?.c || snapshot.lastTrade?.p || snapshot.min?.c || 0,
            volume: dayData?.v || 0,
            changePercent: snapshot.todaysChangePerc || 0,
            rsi14: undefined,
            sma20: undefined,
            sma50: undefined,
            sma200: undefined,
            ema12: undefined,
            ema26: undefined,
            macd: undefined,
            updatedAt: Date.now(),
          };
        })
        .filter(s => s.price > 0); // Only include stocks with a valid price

      this.lastFetchTime = Date.now();
      console.log(`Processed ${this.snapshotCache.length} valid tickers`);
      
      return this.snapshotCache;
    } catch (error) {
      console.error('Failed to fetch market snapshot:', error);
      return this.snapshotCache; // Return stale cache if available
    }
  }

  // Check if stock matches all filter conditions
  private matchesFilter(stock: StockIndicators, conditions: FilterCondition[]): boolean {
    return conditions.every((condition) => {
      const value = stock[condition.field];
      
      if (value === undefined || value === null) {
        return false;
      }

      return this.evaluateCondition(value as number, condition.operator, condition.value);
    });
  }

  // Evaluate single condition
  private evaluateCondition(
    value: number,
    operator: FilterOperator,
    target: number | [number, number]
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > (target as number);
      case 'gte':
        return value >= (target as number);
      case 'lt':
        return value < (target as number);
      case 'lte':
        return value <= (target as number);
      case 'eq':
        return value === (target as number);
      case 'neq':
        return value !== (target as number);
      case 'between':
        const [min, max] = target as [number, number];
        return value >= min && value <= max;
      default:
        return false;
    }
  }

  // Check if preset needs indicator data beyond explicit conditions
  private presetNeedsIndicators(presetId: string): boolean {
    const presetsNeedingIndicators = [
      'goldenCross', 'deathCross', 'aboveSma200', 'belowSma200', 
      'emaCrossover', 'macdBullish', 'uptrend', 'downtrend'
    ];
    return presetsNeedingIndicators.includes(presetId);
  }

  // Apply special logic for specific presets
  private applyPresetLogic(presetId: string, stocks: StockIndicators[]): StockIndicators[] {
    switch (presetId) {
      case 'goldenCross':
        // Price > SMA50 > SMA200 (bullish alignment)
        return stocks.filter(s => 
          s.sma50 !== undefined && s.sma200 !== undefined &&
          s.price > s.sma50 && s.sma50 > s.sma200
        );
      
      case 'deathCross':
        // Price < SMA50 < SMA200 (bearish alignment)
        return stocks.filter(s => 
          s.sma50 !== undefined && s.sma200 !== undefined &&
          s.price < s.sma50 && s.sma50 < s.sma200
        );
      
      case 'aboveSma200':
        // Price above 200-day moving average
        return stocks.filter(s => 
          s.sma200 !== undefined && s.price > s.sma200
        );
      
      case 'belowSma200':
        // Price below 200-day moving average
        return stocks.filter(s => 
          s.sma200 !== undefined && s.price < s.sma200
        );
      
      case 'emaCrossover':
        // EMA12 > EMA26 (short-term momentum bullish)
        return stocks.filter(s => 
          s.ema12 !== undefined && s.ema26 !== undefined &&
          s.ema12 > s.ema26
        );
      
      case 'macdBullish':
        // MACD histogram positive (or price momentum positive)
        return stocks.filter(s => 
          (s.macd?.histogram !== undefined && s.macd.histogram > 0) ||
          (s.changePercent > 0)
        );
      
      case 'uptrend':
        // Price above SMA50 and SMA200
        return stocks.filter(s => 
          s.sma50 !== undefined && s.sma200 !== undefined &&
          s.price > s.sma50 && s.price > s.sma200
        );
      
      case 'downtrend':
        // Price below SMA50 and SMA200
        return stocks.filter(s => 
          s.sma50 !== undefined && s.sma200 !== undefined &&
          s.price < s.sma50 && s.price < s.sma200
        );
      
      default:
        return stocks;
    }
  }

  // Sort stocks by field
  private sortStocks(
    stocks: StockIndicators[],
    sortBy: keyof StockIndicators,
    sortOrder: 'asc' | 'desc'
  ): StockIndicators[] {
    return [...stocks].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }

  // Get all indicators from Redis cache
  private async getAllIndicatorsFromCache(): Promise<StockIndicators[]> {
    try {
      const keys = await redis.keys(`${REDIS_KEYS.TICKER_INDICATORS}*`);
      
      if (keys.length === 0) {
        return [];
      }

      const values = await redis.mget(keys);
      
      return values
        .filter((v): v is string => v !== null)
        .map((v) => JSON.parse(v) as StockIndicators);
    } catch {
      // Redis not connected, return empty
      return [];
    }
  }
}
