import type { ServerWebSocket, WebSocketHandler } from 'bun';
import type { WSMessage, WSSubscribePayload, WSScreenerResultsPayload } from '@screener/shared';
import { ScreenerService } from '../services/screener';
import { PRESET_FILTERS } from '@screener/shared';

export interface WSData {
  subscribedFilters: Set<string>;
}

// Track all connected clients
const clients = new Map<ServerWebSocket<WSData>, WSData>();

const screenerService = new ScreenerService();

export function createWSHandler(): WebSocketHandler<WSData> {
  return {
    open(ws) {
      clients.set(ws, ws.data);
      console.log(`WebSocket client connected. Total clients: ${clients.size}`);
    },

    close(ws) {
      clients.delete(ws);
      console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
    },

    async message(ws, message) {
      try {
        const msg: WSMessage = JSON.parse(message.toString());

        switch (msg.type) {
          case 'subscribe': {
            const payload = msg.payload as WSSubscribePayload;
            ws.data.subscribedFilters.add(payload.filterId);
            
            // Send initial results
            const preset = PRESET_FILTERS[payload.filterId];
            if (preset) {
              const results = await screenerService.runScreener(
                { id: payload.filterId, ...preset },
                1,
                50
              );
              
              const response: WSMessage<WSScreenerResultsPayload> = {
                type: 'screener_results',
                payload: { results },
                timestamp: Date.now(),
              };
              ws.send(JSON.stringify(response));
            }
            break;
          }

          case 'unsubscribe': {
            const payload = msg.payload as WSSubscribePayload;
            ws.data.subscribedFilters.delete(payload.filterId);
            break;
          }

          case 'filter_update': {
            // Handle custom filter updates
            // Re-run screener with new filter
            break;
          }

          default:
            console.warn('Unknown message type:', msg.type);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        const errorMsg: WSMessage = {
          type: 'error',
          payload: { message: 'Invalid message format' },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(errorMsg));
      }
    },
  };
}

// Broadcast updated results to subscribed clients
export async function broadcastScreenerUpdate(filterId: string) {
  const preset = PRESET_FILTERS[filterId];
  if (!preset) return;

  const results = await screenerService.runScreener(
    { id: filterId, ...preset },
    1,
    50
  );

  const message: WSMessage<WSScreenerResultsPayload> = {
    type: 'screener_results',
    payload: { results },
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);

  for (const [ws, data] of clients) {
    if (data.subscribedFilters.has(filterId)) {
      ws.send(messageStr);
    }
  }
}

// Broadcast stock update to all clients
export function broadcastStockUpdate(stock: import('@screener/shared').StockIndicators) {
  const message: WSMessage = {
    type: 'stock_update',
    payload: { stock },
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);

  for (const [ws] of clients) {
    ws.send(messageStr);
  }
}
