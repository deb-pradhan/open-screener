import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ScreenerService } from '../services/screener';
import type { ApiResponse, ScreenerResult, ScreenerFilter, FilterCondition } from '@screener/shared';
import { PRESET_FILTERS } from '@screener/shared';

export const screenerRouter = new Hono();

const screenerService = new ScreenerService();

// Filter condition schema
const filterConditionSchema = z.object({
  field: z.enum([
    'price', 'volume', 'changePercent', 'rsi14',
    'sma20', 'sma50', 'sma200', 'ema12', 'ema26'
  ]),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'between']),
  value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
});

// Screener request schema
const screenerRequestSchema = z.object({
  conditions: z.array(filterConditionSchema),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(50),
});

// Run screener with custom filters
screenerRouter.post(
  '/run',
  zValidator('json', screenerRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    
    try {
      const filter: ScreenerFilter = {
        id: `custom-${Date.now()}`,
        name: 'Custom Filter',
        conditions: body.conditions as FilterCondition[],
        sortBy: body.sortBy as keyof import('@screener/shared').StockIndicators | undefined,
        sortOrder: body.sortOrder,
      };

      const results = await screenerService.runScreener(
        filter,
        body.page,
        body.pageSize
      );

      const response: ApiResponse<ScreenerResult> = {
        success: true,
        data: results,
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
  }
);

// Run preset filter
screenerRouter.get('/preset/:presetId', async (c) => {
  const presetId = c.req.param('presetId');
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 50, 100);

  const preset = PRESET_FILTERS[presetId];
  
  if (!preset) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Preset not found',
      timestamp: Date.now(),
    };
    return c.json(response, 404);
  }

  try {
    const filter: ScreenerFilter = {
      id: presetId,
      ...preset,
    };

    const results = await screenerService.runScreener(filter, page, pageSize);

    const response: ApiResponse<ScreenerResult> = {
      success: true,
      data: results,
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

// Get available presets
screenerRouter.get('/presets', (c) => {
  const presets = Object.entries(PRESET_FILTERS).map(([id, preset]) => ({
    id,
    name: preset.name,
    description: preset.description,
    category: preset.category,
    conditions: preset.conditions,
    sortBy: preset.sortBy,
    sortOrder: preset.sortOrder,
  }));

  const response: ApiResponse<typeof presets> = {
    success: true,
    data: presets,
    timestamp: Date.now(),
  };

  return c.json(response);
});
