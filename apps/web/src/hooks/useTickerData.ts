import { useQuery } from '@tanstack/react-query';
import type { 
  TickerDetailResponse, 
  FinancialsResponse, 
  DividendWithYield,
  ChartData,
  ChartRange,
  NewsArticle,
  StockSplit,
} from '@screener/shared';

const API_URL = import.meta.env.VITE_API_URL || '';

// Core ticker data (loads first, blocks render)
export function useTickerCore(symbol: string) {
  return useQuery({
    queryKey: ['ticker', symbol, 'core'],
    queryFn: async (): Promise<TickerDetailResponse> => {
      const response = await fetch(`${API_URL}/api/ticker/${symbol}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Symbol not found');
        }
        throw new Error('Failed to fetch ticker data');
      }
      return response.json();
    },
    staleTime: 60 * 1000, // 1 min
    gcTime: 5 * 60 * 1000, // 5 min cache
    retry: 2,
  });
}

// Financials data (loads on tab activation)
export function useTickerFinancials(symbol: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticker', symbol, 'financials'],
    queryFn: async (): Promise<FinancialsResponse> => {
      const response = await fetch(`${API_URL}/api/ticker/${symbol}/financials`);
      if (!response.ok) throw new Error('Failed to fetch financials');
      return response.json();
    },
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hour cache
  });
}

// Dividends data
export function useTickerDividends(symbol: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticker', symbol, 'dividends'],
    queryFn: async (): Promise<{ success: boolean; data: DividendWithYield }> => {
      const response = await fetch(`${API_URL}/api/ticker/${symbol}/dividends`);
      if (!response.ok) throw new Error('Failed to fetch dividends');
      return response.json();
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// Stock splits data
export function useTickerSplits(symbol: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticker', symbol, 'splits'],
    queryFn: async (): Promise<{ success: boolean; data: { splits: StockSplit[] } }> => {
      const response = await fetch(`${API_URL}/api/ticker/${symbol}/splits`);
      if (!response.ok) throw new Error('Failed to fetch splits');
      return response.json();
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// News data
export function useTickerNews(symbol: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticker', symbol, 'news'],
    queryFn: async (): Promise<{ success: boolean; data: { articles: NewsArticle[] } }> => {
      const response = await fetch(`${API_URL}/api/ticker/${symbol}/news`);
      if (!response.ok) throw new Error('Failed to fetch news');
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
  });
}

// Chart data
export function useTickerChart(symbol: string, range: ChartRange = '1M', enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticker', symbol, 'chart', range],
    queryFn: async (): Promise<{ success: boolean; data: ChartData }> => {
      const response = await fetch(`${API_URL}/api/ticker/${symbol}/chart?range=${range}`);
      if (!response.ok) throw new Error('Failed to fetch chart data');
      return response.json();
    },
    enabled,
    staleTime: range === '1D' ? 60 * 1000 : 60 * 60 * 1000,
    gcTime: range === '1D' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000,
  });
}
