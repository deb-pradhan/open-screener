import { Hono } from 'hono';
import { IndicatorService } from '../services/indicators';
import type { ApiResponse, StockIndicators } from '@screener/shared';

export const indicatorsRouter = new Hono();

const indicatorService = new IndicatorService();

// Get indicators for a single stock
indicatorsRouter.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();

  try {
    const indicators = await indicatorService.getIndicators(symbol);

    if (!indicators) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Indicators not found for symbol',
        timestamp: Date.now(),
      };
      return c.json(response, 404);
    }

    const response: ApiResponse<StockIndicators> = {
      success: true,
      data: indicators,
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

// Get indicators for multiple stocks
indicatorsRouter.post('/batch', async (c) => {
  const { symbols } = await c.req.json<{ symbols: string[] }>();

  if (!symbols || !Array.isArray(symbols)) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'symbols array is required',
      timestamp: Date.now(),
    };
    return c.json(response, 400);
  }

  try {
    const indicators = await Promise.all(
      symbols.map((s) => indicatorService.getIndicators(s.toUpperCase()))
    );

    const validIndicators = indicators.filter(Boolean) as StockIndicators[];

    const response: ApiResponse<StockIndicators[]> = {
      success: true,
      data: validIndicators,
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

// Trigger indicator refresh (admin endpoint)
indicatorsRouter.post('/refresh', async (c) => {
  try {
    await indicatorService.refreshAllIndicators();

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Indicator refresh started' },
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

// Get all cached indicators (for screener)
indicatorsRouter.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);

  try {
    const indicators = await indicatorService.getAllIndicators(limit);

    const response: ApiResponse<StockIndicators[]> = {
      success: true,
      data: indicators,
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
