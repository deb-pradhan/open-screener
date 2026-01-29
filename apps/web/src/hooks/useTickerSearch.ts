import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface SearchResult {
  symbol: string;
  name: string;
  market: string;
  type: string;
  primaryExchange: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function searchTickers(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return [];
  
  const res = await fetch(`${API_BASE}/tickers?search=${encodeURIComponent(query)}&limit=10`);
  const json: ApiResponse<SearchResult[]> = await res.json();
  
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Search failed');
  }
  
  return json.data;
}

export function useTickerSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['ticker-search', debouncedQuery],
    queryFn: () => searchTickers(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30000, // 30 seconds
  });

  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading: isLoading && debouncedQuery.length >= 1,
    error,
    clear,
    hasResults: results.length > 0,
  };
}
