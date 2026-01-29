import { Hono } from 'hono';
import { db, schema, checkDbConnection } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import type { ApiResponse } from '@screener/shared';
import { MassiveClient } from '../clients/massive';

export const tickersRouter = new Hono();

// Shared client instance for fallback searches
const massiveClient = new MassiveClient();

// Get all tickers with optional search
tickersRouter.get('/', async (c) => {
  const search = c.req.query('search')?.trim().toUpperCase();
  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);
  const offset = Number(c.req.query('offset')) || 0;

  // Check database connection first
  const isConnected = await checkDbConnection();
  
  // If no DB connection, fall back to Polygon API for search
  if (!isConnected) {
    // Only allow search fallback, not full listing (would be too expensive)
    if (!search || search.length < 1) {
      const response: ApiResponse<[]> = {
        success: true,
        data: [],
        timestamp: Date.now(),
      };
      return c.json(response);
    }

    try {
      // Use Polygon API as fallback for search
      const tickers = await massiveClient.getTickers({ 
        search, 
        limit: Math.min(limit, 20), // Limit API calls
        active: true,
      });

      // Map to our expected format
      const results = tickers.map(t => ({
        symbol: t.ticker,
        name: t.name,
        price: null as number | null,
        changePercent: null as number | null,
        logoUrl: null as string | null,
      }));

      const response: ApiResponse<typeof results> = {
        success: true,
        data: results,
        timestamp: Date.now(),
      };
      return c.json(response);
    } catch (error) {
      console.error('Polygon API fallback search error:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Search temporarily unavailable',
        timestamp: Date.now(),
      };
      return c.json(response, 503);
    }
  }

  try {
    // Use latest_snapshot for search - it has the data we need and is faster
    const conditions = [];
    
    if (search) {
      // Search by symbol (exact start match first) or name
      conditions.push(
        sql`(${schema.latestSnapshot.symbol} ILIKE ${`${search}%`} OR ${schema.latestSnapshot.name} ILIKE ${`%${search}%`})`
      );
    }

    const results = await db
      .select({
        symbol: schema.latestSnapshot.symbol,
        name: schema.latestSnapshot.name,
        price: schema.latestSnapshot.price,
        changePercent: schema.latestSnapshot.changePercent,
        logoUrl: schema.latestSnapshot.logoUrl,
      })
      .from(schema.latestSnapshot)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        // Prioritize exact symbol matches, then by market cap
        search 
          ? sql`CASE WHEN ${schema.latestSnapshot.symbol} = ${search} THEN 0 WHEN ${schema.latestSnapshot.symbol} LIKE ${search + '%'} THEN 1 ELSE 2 END`
          : desc(schema.latestSnapshot.marketCap)
      )
      .limit(limit)
      .offset(offset);

    const response: ApiResponse<typeof results> = {
      success: true,
      data: results,
      timestamp: Date.now(),
    };

    return c.json(response);
  } catch (error) {
    console.error('Ticker search error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});

// Get ticker count - must be before /:symbol route
tickersRouter.get('/stats/count', async (c) => {
  const isConnected = await checkDbConnection();
  if (!isConnected) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Database not available',
      timestamp: Date.now(),
    };
    return c.json(response, 503);
  }

  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.latestSnapshot);

    const response: ApiResponse<{ count: number }> = {
      success: true,
      data: { count: Number(result.count) },
      timestamp: Date.now(),
    };

    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});

// Get single ticker
tickersRouter.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();

  const isConnected = await checkDbConnection();
  if (!isConnected) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Database not available',
      timestamp: Date.now(),
    };
    return c.json(response, 503);
  }

  try {
    const [ticker] = await db
      .select({
        symbol: schema.latestSnapshot.symbol,
        name: schema.latestSnapshot.name,
        price: schema.latestSnapshot.price,
        changePercent: schema.latestSnapshot.changePercent,
        logoUrl: schema.latestSnapshot.logoUrl,
      })
      .from(schema.latestSnapshot)
      .where(eq(schema.latestSnapshot.symbol, symbol))
      .limit(1);

    if (!ticker) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Ticker not found',
        timestamp: Date.now(),
      };
      return c.json(response, 404);
    }

    const response: ApiResponse<typeof ticker> = {
      success: true,
      data: ticker,
      timestamp: Date.now(),
    };

    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});
