import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickerDividends, useTickerSplits } from '@/hooks/useTickerData';
import { RefreshCw, Wallet, Split } from 'lucide-react';

interface TickerDividendsProps {
  symbol: string;
}

export function TickerDividends({ symbol }: TickerDividendsProps) {
  const { data: dividendData, isLoading: divLoading, error: divError } = useTickerDividends(symbol);
  const { data: splitData, isLoading: splitLoading, error: splitError } = useTickerSplits(symbol);

  return (
    <div className="space-y-4">
      {/* Dividends */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-accent-main" />
              Dividend History
            </span>
            {dividendData?.data?.trailingYield && (
              <Badge variant="secondary">
                TTM Yield: {dividendData.data.trailingYield.toFixed(2)}%
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {divError ? (
            <div className="py-4 text-center text-signal-error text-sm">
              Failed to load dividend data
            </div>
          ) : divLoading ? (
            <div className="py-4 text-center text-ink-tertiary">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : !dividendData?.data?.dividends?.length ? (
            <div className="py-4 text-center text-ink-tertiary text-sm">
              No dividend history available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-element">
                    <th className="text-left py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                      Ex-Date
                    </th>
                    <th className="text-left py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                      Pay Date
                    </th>
                    <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-center py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                      Frequency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dividendData.data.dividends.slice(0, 12).map((div, idx) => (
                    <tr key={idx} className="border-b border-border-element hover:bg-surface-subtle">
                      <td className="py-2 px-2 font-mono text-ink-primary">
                        {div.exDividendDate}
                      </td>
                      <td className="py-2 px-2 font-mono text-ink-secondary">
                        {div.payDate || '—'}
                      </td>
                      <td className="text-right py-2 px-2 font-mono tabular-nums text-positive">
                        ${div.amount.toFixed(4)}
                      </td>
                      <td className="text-center py-2 px-2 text-ink-tertiary">
                        {div.frequency === 4 ? 'Q' : div.frequency === 12 ? 'M' : div.frequency === 2 ? 'SA' : div.frequency === 1 ? 'A' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Splits */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Split className="h-4 w-4 text-accent-main" />
            Stock Split History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {splitError ? (
            <div className="py-4 text-center text-signal-error text-sm">
              Failed to load split data
            </div>
          ) : splitLoading ? (
            <div className="py-4 text-center text-ink-tertiary">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : !splitData?.data?.splits?.length ? (
            <div className="py-4 text-center text-ink-tertiary text-sm">
              No stock splits recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-element">
                    <th className="text-left py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                      Ratio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {splitData.data.splits.map((split, idx) => (
                    <tr key={idx} className="border-b border-border-element hover:bg-surface-subtle">
                      <td className="py-2 px-2 font-mono text-ink-primary">
                        {split.executionDate}
                      </td>
                      <td className="text-right py-2 px-2 font-mono tabular-nums text-ink-secondary">
                        {split.splitTo}:{split.splitFrom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
