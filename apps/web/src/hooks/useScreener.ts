import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, ScreenerResult } from '@screener/shared';

// API base - works in both dev (proxied) and production (same origin)
const API_BASE = '/api';

async function fetchPresetScreener(presetId: string, page: number = 1, pageSize: number = 50): Promise<ScreenerResult> {
  const response = await fetch(
    `${API_BASE}/screener/preset/${presetId}?page=${page}&pageSize=${pageSize}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch screener results');
  }

  const data: ApiResponse<ScreenerResult> = await response.json();
  
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.data;
}

async function fetchPresets(): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${API_BASE}/screener/presets`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch presets');
  }

  const data: ApiResponse<Array<{ id: string; name: string }>> = await response.json();
  
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.data;
}

export function usePresetScreener(presetId: string, page: number = 1, pageSize: number = 50) {
  return useQuery({
    queryKey: ['screener', presetId, page, pageSize],
    queryFn: () => fetchPresetScreener(presetId, page, pageSize),
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function usePresets() {
  return useQuery({
    queryKey: ['presets'],
    queryFn: fetchPresets,
    staleTime: 300000, // 5 minutes
  });
}
