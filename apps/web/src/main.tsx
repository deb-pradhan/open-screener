import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { PresetExplorer } from './components/screener/PresetExplorer';
import { ScreenerView } from './components/screener/ScreenerView';
import { FilterBuilder } from './components/screener/FilterBuilder';
import { TickerPageSkeleton } from './pages/TickerPageSkeleton';
import './index.css';

// Lazy load ticker detail page (larger bundle)
const TickerDetailPage = lazy(() => import('./pages/TickerDetailPage'));

// Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchInterval: 60000, // 1 minute
      retry: 2,
    },
  },
});

// Prefetch ticker data on hover
export const prefetchTickerData = (symbol: string) => {
  queryClient.prefetchQuery({
    queryKey: ['ticker', symbol, 'core'],
    queryFn: async () => {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/ticker/${symbol}`);
      if (!response.ok) throw new Error('Failed to fetch ticker');
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });
};

// Router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout><Outlet /></AppLayout>,
    children: [
      {
        index: true,
        element: <PresetExplorer />,
      },
      {
        path: 'screener/:presetId',
        element: <ScreenerView />,
      },
      {
        path: 'custom',
        element: <FilterBuilder />,
      },
      {
        path: 'ticker/:symbol',
        element: (
          <Suspense fallback={<TickerPageSkeleton />}>
            <TickerDetailPage />
          </Suspense>
        ),
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
