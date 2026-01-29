import { useEffect, useRef, useState, useCallback } from 'react';
import { useScreenerStore } from '@/stores/screenerStore';
import type { WSMessage, WSScreenerResultsPayload, WSStockUpdatePayload } from '@screener/shared';

// Dynamic WebSocket URL based on environment
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  // In development, API runs on port 3001
  if (import.meta.env.DEV) {
    return `ws://${window.location.hostname}:3001/ws`;
  }
  
  // In production, same origin
  return `${protocol}//${host}/ws`;
};

const WS_URL = getWebSocketUrl();

export function useWebSocket(filterId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const { setResults, updateStock } = useScreenerStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Subscribe to filter if provided
        if (filterId) {
          subscribe(filterId);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      attemptReconnect();
    }
  }, [filterId]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= 5) {
      console.log('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current++;

    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const handleMessage = useCallback((message: WSMessage) => {
    setLastUpdate(message.timestamp);

    switch (message.type) {
      case 'screener_results': {
        const payload = message.payload as WSScreenerResultsPayload;
        setResults(payload.results);
        break;
      }
      case 'stock_update': {
        const payload = message.payload as WSStockUpdatePayload;
        updateStock(payload.stock);
        break;
      }
      case 'error': {
        console.error('WebSocket error:', message.payload);
        break;
      }
    }
  }, [setResults, updateStock]);

  const subscribe = useCallback((filterId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WSMessage = {
      type: 'subscribe',
      payload: { filterId },
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(message));
  }, []);

  const unsubscribe = useCallback((filterId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WSMessage = {
      type: 'unsubscribe',
      payload: { filterId },
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(message));
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Subscribe to filter changes
  useEffect(() => {
    if (isConnected && filterId) {
      subscribe(filterId);
    }
  }, [isConnected, filterId, subscribe]);

  return {
    isConnected,
    lastUpdate,
    subscribe,
    unsubscribe,
  };
}
