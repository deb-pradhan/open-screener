import { IndicatorService } from '../services/indicators';
import { getMassiveWSClient } from '../clients/massive-websocket';
import { broadcastScreenerUpdate } from '../routes/websocket';
import { PRESET_FILTERS } from '@screener/shared';

const indicatorService = new IndicatorService();

let refreshInterval: ReturnType<typeof setInterval> | null = null;
let isRefreshing = false;

// Start the indicator refresh worker
export function startIndicatorRefreshWorker(intervalMs: number = 60000): void {
  if (refreshInterval) {
    console.log('Indicator refresh worker already running');
    return;
  }

  console.log(`Starting indicator refresh worker (interval: ${intervalMs}ms)`);

  // Initial refresh
  refreshIndicators();

  // Set up interval
  refreshInterval = setInterval(() => {
    refreshIndicators();
  }, intervalMs);
}

// Stop the indicator refresh worker
export function stopIndicatorRefreshWorker(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('Indicator refresh worker stopped');
  }
}

// Refresh all indicators
async function refreshIndicators(): Promise<void> {
  if (isRefreshing) {
    console.log('Refresh already in progress, skipping...');
    return;
  }

  isRefreshing = true;
  const startTime = Date.now();

  try {
    await indicatorService.refreshAllIndicators();
    
    // Broadcast updates for all preset filters
    for (const presetId of Object.keys(PRESET_FILTERS)) {
      await broadcastScreenerUpdate(presetId);
    }

    const duration = Date.now() - startTime;
    console.log(`Indicator refresh completed in ${duration}ms`);
  } catch (error) {
    console.error('Indicator refresh failed:', error);
  } finally {
    isRefreshing = false;
  }
}

// Start WebSocket connection for real-time updates
export function startRealtimeUpdates(symbols?: string[]): void {
  const wsClient = getMassiveWSClient();
  
  wsClient.connect().then(() => {
    if (symbols && symbols.length > 0) {
      wsClient.subscribeToAggregates(symbols);
    } else {
      // Subscribe to all stocks (high volume - use with caution)
      // wsClient.subscribeToAllStocks();
      console.log('WebSocket connected. Call subscribeToAggregates with specific symbols.');
    }
  });
}

// Subscribe to specific symbols for real-time updates
export function subscribeToSymbols(symbols: string[]): void {
  const wsClient = getMassiveWSClient();
  wsClient.subscribeToAggregates(symbols);
}
