import { useEffect, useRef, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from 'lucide-react';

interface TickerChartProps {
  symbol: string;
}

function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: '240', // 4H timeframe
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1', // Candlestick
      locale: 'en',
      allow_symbol_change: false,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      backgroundColor: 'rgba(255, 255, 255, 1)', // surface-card
      gridColor: 'rgba(224, 226, 230, 1)', // border-element
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
      <div
        ref={containerRef}
        className="tradingview-widget-container__widget"
        style={{ height: 'calc(100% - 32px)', width: '100%' }}
      />
    </div>
  );
}

const MemoizedTradingViewWidget = memo(TradingViewWidget);

export function TickerChart({ symbol }: TickerChartProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <LineChart className="h-4 w-4 text-accent-main" />
          Price Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full">
          <MemoizedTradingViewWidget symbol={symbol} />
        </div>
      </CardContent>
    </Card>
  );
}
