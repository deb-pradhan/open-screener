import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTickerChart } from '@/hooks/useTickerData';
import { RefreshCw, LineChart } from 'lucide-react';
import type { ChartRange } from '@screener/shared';

interface TickerChartProps {
  symbol: string;
}

const RANGES: { value: ChartRange; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: '5Y', label: '5Y' },
];

export function TickerChart({ symbol }: TickerChartProps) {
  const [range, setRange] = useState<ChartRange>('1M');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  
  const { data, isLoading, error } = useTickerChart(symbol, range);

  useEffect(() => {
    if (!chartContainerRef.current || !data?.data?.bars?.length) return;

    // Dynamic import for lightweight-charts to avoid SSR issues
    const initChart = async () => {
      const { createChart, ColorType } = await import('lightweight-charts');
      
      // Clean up existing chart
      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'hsl(var(--ink-secondary))',
        },
        grid: {
          vertLines: { color: 'hsl(var(--border-element))' },
          horzLines: { color: 'hsl(var(--border-element))' },
        },
        width: chartContainerRef.current!.clientWidth,
        height: 400,
        crosshair: {
          mode: 1,
        },
        timeScale: {
          borderColor: 'hsl(var(--border-element))',
          timeVisible: range === '1D',
        },
        rightPriceScale: {
          borderColor: 'hsl(var(--border-element))',
        },
      });

      chartRef.current = chart;

      // Add candlestick series for intraday, line for longer periods
      if (range === '1D' || range === '1W') {
        const candleSeries = chart.addCandlestickSeries({
          upColor: 'hsl(var(--positive))',
          downColor: 'hsl(var(--negative))',
          borderUpColor: 'hsl(var(--positive))',
          borderDownColor: 'hsl(var(--negative))',
          wickUpColor: 'hsl(var(--positive))',
          wickDownColor: 'hsl(var(--negative))',
        });

        const candleData = data.data.bars.map(bar => ({
          time: bar.t / 1000 as any, // Convert to seconds
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
        }));

        candleSeries.setData(candleData);
      } else {
        const areaSeries = chart.addAreaSeries({
          lineColor: 'hsl(var(--accent-main))',
          topColor: 'hsla(var(--accent-main), 0.4)',
          bottomColor: 'hsla(var(--accent-main), 0.04)',
          lineWidth: 2,
        });

        const lineData = data.data.bars.map(bar => ({
          time: bar.t / 1000 as any, // Convert to seconds
          value: bar.c,
        }));

        areaSeries.setData(lineData);
      }

      // Fit content
      chart.timeScale().fitContent();

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, range]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <LineChart className="h-4 w-4 text-accent-main" />
          Price Chart
        </CardTitle>
        <div className="flex items-center gap-1">
          {RANGES.map(({ value, label }) => (
            <Button
              key={value}
              variant={range === value ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setRange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="h-[400px] flex items-center justify-center text-signal-error">
            Failed to load chart data
          </div>
        ) : isLoading ? (
          <div className="h-[400px] flex items-center justify-center text-ink-tertiary">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading chart...
          </div>
        ) : !data?.data?.bars?.length ? (
          <div className="h-[400px] flex items-center justify-center text-ink-tertiary">
            No chart data available
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full" />
        )}
        {data?.data?.source && (
          <p className="text-[10px] text-ink-tertiary mt-2 text-right">
            Source: {data.data.source === 'db' ? 'Database' : 'Live API'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
