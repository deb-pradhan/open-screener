import { Hono } from 'hono';
import { db, schema } from '../db';
import { eq, ilike, and, sql } from 'drizzle-orm';
import type { ApiResponse, Ticker } from '@screener/shared';

export const tickersRouter = new Hono();

// Get all tickers with optional search
tickersRouter.get('/', async (c) => {
  const search = c.req.query('search');
  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);
  const offset = Number(c.req.query('offset')) || 0;
  const activeOnly = c.req.query('active') !== 'false';

  try {
    const conditions = [];
    
    if (activeOnly) {
      conditions.push(eq(schema.tickers.active, true));
    }
    
    if (search) {
      conditions.push(
        sql`(${schema.tickers.symbol} ILIKE ${`%${search}%`} OR ${schema.tickers.name} ILIKE ${`%${search}%`})`
      );
    }

    const tickers = await db
      .select()
      .from(schema.tickers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset);

    const response: ApiResponse<typeof tickers> = {
      success: true,
      data: tickers,
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

  try {
    const [ticker] = await db
      .select()
      .from(schema.tickers)
      .where(eq(schema.tickers.symbol, symbol))
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

// Get ticker count
tickersRouter.get('/stats/count', async (c) => {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.tickers)
      .where(eq(schema.tickers.active, true));

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
