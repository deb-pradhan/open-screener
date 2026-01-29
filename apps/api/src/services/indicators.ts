import { redis, REDIS_KEYS, REDIS_TTL } from '../lib/redis';
import { MassiveClient } from '../clients/massive';
import type { StockIndicators } from '@screener/shared';

export class IndicatorService {
  private massiveClient: MassiveClient;

  constructor() {
    this.massiveClient = new MassiveClient();
  }

  // Get indicators for a single symbol
  async getIndicators(symbol: string): Promise<StockIndicators | null> {
    // Try cache first
    try {
      const cached = await redis.get(`${REDIS_KEYS.TICKER_INDICATORS}${symbol}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Continue without cache
    }

    // Fetch fresh data
    try {
      const indicators = await this.fetchIndicatorsForSymbol(symbol);
      
      if (indicators) {
        // Cache the result
        try {
          await redis.setex(
            `${REDIS_KEYS.TICKER_INDICATORS}${symbol}`,
            REDIS_TTL.INDICATORS,
            JSON.stringify(indicators)
          );
        } catch {
          // Ignore cache errors
        }
      }

      return indicators;
    } catch (error) {
      console.error(`Failed to fetch indicators for ${symbol}:`, error);
      return null;
    }
  }

  // Get all cached indicators
  async getAllIndicators(limit: number = 1000): Promise<StockIndicators[]> {
    try {
      const keys = await redis.keys(`${REDIS_KEYS.TICKER_INDICATORS}*`);
      
      if (keys.length === 0) {
        return [];
      }

      const keysToFetch = keys.slice(0, limit);
      const values = await redis.mget(keysToFetch);

      return values
        .filter((v): v is string => v !== null)
        .map((v) => JSON.parse(v) as StockIndicators);
    } catch {
      return [];
    }
  }

  // Refresh all indicators (background job)
  async refreshAllIndicators(): Promise<void> {
    console.log('Starting indicator refresh...');
    
    try {
      // Get market snapshot
      const snapshot = await this.massiveClient.getMarketSnapshot();
      
      if (!snapshot || snapshot.length === 0) {
        console.log('No snapshot data available');
        return;
      }

      console.log(`Processing ${snapshot.length} tickers...`);

      // Process in batches to avoid overwhelming the API
      const batchSize = 50;
      for (let i = 0; i < snapshot.length; i += batchSize) {
        const batch = snapshot.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (ticker) => {
            try {
              const indicators = await this.buildIndicatorsFromSnapshot(ticker);
              
              if (indicators) {
                await redis.setex(
                  `${REDIS_KEYS.TICKER_INDICATORS}${indicators.symbol}`,
                  REDIS_TTL.INDICATORS,
                  JSON.stringify(indicators)
                );
              }
            } catch (error) {
              // Log but don't fail the whole batch
              console.error(`Failed to process ${ticker.ticker}:`, error);
            }
          })
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log('Indicator refresh complete');
    } catch (error) {
      console.error('Indicator refresh failed:', error);
      throw error;
    }
  }

  // Fetch indicators for a single symbol
  private async fetchIndicatorsForSymbol(symbol: string): Promise<StockIndicators | null> {
    try {
      // Get snapshot for current price/volume
      const snapshot = await this.massiveClient.getTickerSnapshot(symbol);
      
      if (!snapshot) {
        return null;
      }

      return this.buildIndicatorsFromSnapshot(snapshot);
    } catch {
      return null;
    }
  }

  // Build indicators from snapshot + technical indicator APIs
  private async buildIndicatorsFromSnapshot(
    snapshot: import('@screener/shared').TickerSnapshot
  ): Promise<StockIndicators | null> {
    if (!snapshot.day || !snapshot.ticker) {
      return null;
    }

    const symbol = snapshot.ticker;
    const price = snapshot.day.c || snapshot.lastTrade?.p || 0;
    const volume = snapshot.day.v || 0;

    // Fetch technical indicators in parallel
    const [rsi, sma20, sma50, sma200, ema12, ema26, macd] = await Promise.all([
      this.massiveClient.getRSI(symbol, 14).catch(() => null),
      this.massiveClient.getSMA(symbol, 20).catch(() => null),
      this.massiveClient.getSMA(symbol, 50).catch(() => null),
      this.massiveClient.getSMA(symbol, 200).catch(() => null),
      this.massiveClient.getEMA(symbol, 12).catch(() => null),
      this.massiveClient.getEMA(symbol, 26).catch(() => null),
      this.massiveClient.getMACD(symbol).catch(() => null),
    ]);

    const indicators: StockIndicators = {
      symbol,
      price,
      volume,
      changePercent: snapshot.todaysChangePerc || 0,
      rsi14: rsi?.value,
      sma20: sma20?.value,
      sma50: sma50?.value,
      sma200: sma200?.value,
      ema12: ema12?.value,
      ema26: ema26?.value,
      macd: macd ? {
        value: macd.value,
        signal: macd.signal,
        histogram: macd.histogram,
      } : undefined,
      updatedAt: Date.now(),
    };

    return indicators;
  }
}
