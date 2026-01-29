import { create } from 'zustand';
import type { ScreenerResult, StockIndicators, FilterCondition } from '@screener/shared';

interface ScreenerState {
  // Results
  results: ScreenerResult | null;
  isLoading: boolean;
  error: string | null;

  // Custom filter
  customConditions: FilterCondition[];
  sortBy: keyof StockIndicators | null;
  sortOrder: 'asc' | 'desc';

  // Actions
  setResults: (results: ScreenerResult) => void;
  updateStock: (stock: StockIndicators) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addCondition: (condition: FilterCondition) => void;
  removeCondition: (index: number) => void;
  updateCondition: (index: number, condition: FilterCondition) => void;
  clearConditions: () => void;
  setSort: (field: keyof StockIndicators | null, order: 'asc' | 'desc') => void;
}

export const useScreenerStore = create<ScreenerState>((set) => ({
  // Initial state
  results: null,
  isLoading: false,
  error: null,
  customConditions: [],
  sortBy: null,
  sortOrder: 'desc',

  // Actions
  setResults: (results) => set({ results, isLoading: false, error: null }),

  updateStock: (stock) =>
    set((state) => {
      if (!state.results) return state;

      const updatedStocks = state.results.stocks.map((s) =>
        s.symbol === stock.symbol ? stock : s
      );

      return {
        results: {
          ...state.results,
          stocks: updatedStocks,
          timestamp: Date.now(),
        },
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  addCondition: (condition) =>
    set((state) => ({
      customConditions: [...state.customConditions, condition],
    })),

  removeCondition: (index) =>
    set((state) => ({
      customConditions: state.customConditions.filter((_, i) => i !== index),
    })),

  updateCondition: (index, condition) =>
    set((state) => ({
      customConditions: state.customConditions.map((c, i) =>
        i === index ? condition : c
      ),
    })),

  clearConditions: () => set({ customConditions: [] }),

  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
}));
