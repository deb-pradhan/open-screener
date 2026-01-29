import { Hono } from 'hono';
import { dataSyncService } from '../services/data-sync';
import type { ApiResponse } from '@screener/shared';

export const syncRouter = new Hono();

// Trigger hourly snapshot sync
syncRouter.post('/snapshot', async (c) => {
  try {
    const result = await dataSyncService.syncHourlySnapshot();
    
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});

// Trigger daily full sync
syncRouter.post('/daily', async (c) => {
  try {
    const result = await dataSyncService.syncDailyData();
    
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});

// Backfill a specific symbol
syncRouter.post('/backfill/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const days = Number(c.req.query('days')) || 30;
  
  try {
    await dataSyncService.backfillSymbol(symbol, days);
    
    const response: ApiResponse<{ symbol: string; days: number }> = {
      success: true,
      data: { symbol, days },
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Backfill failed',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});

// Get sync status
syncRouter.get('/status', async (c) => {
  try {
    const [lastSync, count] = await Promise.all([
      dataSyncService.getLastSyncTime(),
      dataSyncService.getSnapshotCount(),
    ]);
    
    const response: ApiResponse<{
      lastSyncTime: string | null;
      snapshotCount: number;
    }> = {
      success: true,
      data: {
        lastSyncTime: lastSync?.toISOString() || null,
        snapshotCount: count,
      },
      timestamp: Date.now(),
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
      timestamp: Date.now(),
    };
    return c.json(response, 500);
  }
});
