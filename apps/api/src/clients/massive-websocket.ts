import { broadcastStockUpdate } from '../routes/websocket';
import { redis, REDIS_KEYS, REDIS_TTL } from '../lib/redis';
import type { StockIndicators } from '@screener/shared';

const WS_URL_DELAYED = 'wss://delayed.polygon.io/stocks';
const WS_URL_REALTIME = 'wss://socket.polygon.io/stocks';

interface WSMessage {
  ev: string; // event type
  sym: string; // symbol
  v?: number; // volume
  av?: number; // accumulated volume
  o?: number; // open
  c?: number; // close
  h?: number; // high
  l?: number; // low
  a?: number; // vwap
  s?: number; // start timestamp
  e?: number; // end timestamp
  n?: number; // number of trades
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

export class MassiveWebSocketClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private useRealtime: boolean;
  private state: ConnectionState = 'disconnected';
  private subscribedSymbols: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private indicatorCache: Map<string, Partial<StockIndicators>> = new Map();

  constructor(useRealtime: boolean = false) {
    this.apiKey = process.env.MASSIVE_API_KEY || '';
    this.useRealtime = useRealtime;
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    if (!this.apiKey) {
      console.error('MASSIVE_API_KEY not set. WebSocket connection will fail.');
      return;
    }

    this.state = 'connecting';
    const url = this.useRealtime ? WS_URL_REALTIME : WS_URL_DELAYED;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connected to Massive');
        this.authenticate();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.state = 'disconnected';
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.state = 'disconnected';
      this.attemptReconnect();
    }
  }

  // Authenticate with API key
  private authenticate(): void {
    if (!this.ws) return;

    this.ws.send(JSON.stringify({ action: 'auth', params: this.apiKey }));
  }

  // Handle incoming messages
  private handleMessage(data: string): void {
    try {
      const messages: WSMessage[] = JSON.parse(data);
      
      if (!Array.isArray(messages)) {
        this.processSingleMessage(messages);
        return;
      }

      for (const msg of messages) {
        this.processSingleMessage(msg);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  // Process a single message
  private processSingleMessage(msg: WSMessage): void {
    switch (msg.ev) {
      case 'status':
        this.handleStatusMessage(msg);
        break;
      case 'AM': // Aggregate per minute
        this.handleAggregateMessage(msg);
        break;
      case 'A': // Aggregate per second
        this.handleAggregateMessage(msg);
        break;
      case 'T': // Trade
        // Could process individual trades if needed
        break;
      case 'Q': // Quote
        // Could process quotes if needed
        break;
      default:
        // Unknown event type
        break;
    }
  }

  // Handle status messages (auth success, subscription confirmations)
  private handleStatusMessage(msg: any): void {
    if (msg.status === 'auth_success') {
      console.log('WebSocket authenticated');
      this.state = 'authenticated';
      this.reconnectAttempts = 0;
      
      // Resubscribe to previously subscribed symbols
      if (this.subscribedSymbols.size > 0) {
        this.subscribeToAggregates([...this.subscribedSymbols]);
      }
    } else if (msg.status === 'auth_failed') {
      console.error('WebSocket authentication failed');
      this.disconnect();
    } else if (msg.status === 'success') {
      console.log('WebSocket subscription confirmed:', msg.message);
    }
  }

  // Handle aggregate (minute bar) messages
  private async handleAggregateMessage(msg: WSMessage): Promise<void> {
    const symbol = msg.sym;
    
    if (!symbol) return;

    // Update indicator cache
    const existing = this.indicatorCache.get(symbol) || {};
    const updated: Partial<StockIndicators> = {
      ...existing,
      symbol,
      price: msg.c || existing.price,
      volume: msg.av || msg.v || existing.volume,
      updatedAt: Date.now(),
    };

    this.indicatorCache.set(symbol, updated);

    // Update Redis cache
    try {
      const cacheKey = `${REDIS_KEYS.TICKER_INDICATORS}${symbol}`;
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        const indicators: StockIndicators = JSON.parse(cachedData);
        indicators.price = msg.c || indicators.price;
        indicators.volume = msg.av || msg.v || indicators.volume;
        indicators.updatedAt = Date.now();
        
        await redis.setex(cacheKey, REDIS_TTL.INDICATORS, JSON.stringify(indicators));
        
        // Broadcast update to connected clients
        broadcastStockUpdate(indicators);
      }
    } catch (error) {
      // Ignore cache errors
    }
  }

  // Subscribe to aggregate updates for symbols
  subscribeToAggregates(symbols: string[]): void {
    if (!this.ws || this.state !== 'authenticated') {
      // Queue for later when connected
      symbols.forEach((s) => this.subscribedSymbols.add(s));
      return;
    }

    const subs = symbols.map((s) => `AM.${s}`).join(',');
    this.ws.send(JSON.stringify({ action: 'subscribe', params: subs }));
    
    symbols.forEach((s) => this.subscribedSymbols.add(s));
    console.log(`Subscribed to ${symbols.length} symbols`);
  }

  // Subscribe to all stocks (use with caution - high volume)
  subscribeToAllStocks(): void {
    if (!this.ws || this.state !== 'authenticated') {
      return;
    }

    this.ws.send(JSON.stringify({ action: 'subscribe', params: 'AM.*' }));
    console.log('Subscribed to all stock aggregates');
  }

  // Unsubscribe from symbols
  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.state !== 'authenticated') {
      return;
    }

    const subs = symbols.map((s) => `AM.${s}`).join(',');
    this.ws.send(JSON.stringify({ action: 'unsubscribe', params: subs }));
    
    symbols.forEach((s) => this.subscribedSymbols.delete(s));
  }

  // Disconnect
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = 'disconnected';
  }

  // Attempt to reconnect
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Get connection state
  getState(): ConnectionState {
    return this.state;
  }
}

// Singleton instance
let wsClient: MassiveWebSocketClient | null = null;

export function getMassiveWSClient(useRealtime: boolean = false): MassiveWebSocketClient {
  if (!wsClient) {
    wsClient = new MassiveWebSocketClient(useRealtime);
  }
  return wsClient;
}
