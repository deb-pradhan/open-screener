import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTickerFinancials } from '@/hooks/useTickerData';
import { formatNumber } from '@/lib/utils';
import { RefreshCw, FileText } from 'lucide-react';

interface TickerFinancialsProps {
  symbol: string;
}

type StatementType = 'income' | 'balance' | 'cashFlow';

export function TickerFinancials({ symbol }: TickerFinancialsProps) {
  const [activeStatement, setActiveStatement] = useState<StatementType>('income');
  const { data, isLoading, error } = useTickerFinancials(symbol);

  if (error) {
    return (
      <Card className="border-signal-error/20">
        <CardContent className="py-8 text-center text-signal-error">
          Failed to load financial data
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-ink-tertiary">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading financials...
        </CardContent>
      </Card>
    );
  }

  const statements = data?.data || { income: [], balance: [], cashFlow: [] };
  const currentStatements = statements[activeStatement];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-accent-main" />
          Financial Statements
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant={activeStatement === 'income' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setActiveStatement('income')}
          >
            Income
          </Button>
          <Button
            variant={activeStatement === 'balance' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setActiveStatement('balance')}
          >
            Balance
          </Button>
          <Button
            variant={activeStatement === 'cashFlow' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setActiveStatement('cashFlow')}
          >
            Cash Flow
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {currentStatements.length === 0 ? (
          <div className="py-8 text-center text-ink-tertiary">
            No {activeStatement} statement data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-element">
                  <th className="text-left py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                    Period
                  </th>
                  {activeStatement === 'income' && (
                    <>
                      <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                        Net Income
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                        EPS
                      </th>
                    </>
                  )}
                  {activeStatement === 'balance' && (
                    <>
                      <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                        Total Assets
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                        Total Liabilities
                      </th>
                    </>
                  )}
                  {activeStatement === 'cashFlow' && (
                    <>
                      <th className="text-right py-2 px-2 text-[10px] text-ink-tertiary uppercase tracking-wider">
                        Operating Cash Flow
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentStatements.map((stmt, idx) => (
                  <tr key={idx} className="border-b border-border-element hover:bg-surface-subtle">
                    <td className="py-2 px-2 font-mono text-ink-primary">
                      {stmt.fiscalQuarter ? `Q${stmt.fiscalQuarter} ` : ''}
                      {stmt.fiscalYear}
                    </td>
                    {activeStatement === 'income' && (
                      <>
                        <td className="text-right py-2 px-2 font-mono tabular-nums text-ink-secondary">
                          {stmt.revenue ? `$${formatNumber(stmt.revenue / 1e6, 1)}M` : '—'}
                        </td>
                        <td className={`text-right py-2 px-2 font-mono tabular-nums ${
                          stmt.netIncome && stmt.netIncome > 0 ? 'text-positive' : stmt.netIncome && stmt.netIncome < 0 ? 'text-negative' : 'text-ink-secondary'
                        }`}>
                          {stmt.netIncome ? `$${formatNumber(stmt.netIncome / 1e6, 1)}M` : '—'}
                        </td>
                        <td className={`text-right py-2 px-2 font-mono tabular-nums ${
                          stmt.eps && stmt.eps > 0 ? 'text-positive' : stmt.eps && stmt.eps < 0 ? 'text-negative' : 'text-ink-secondary'
                        }`}>
                          {stmt.eps ? `$${stmt.eps.toFixed(2)}` : '—'}
                        </td>
                      </>
                    )}
                    {activeStatement === 'balance' && (
                      <>
                        <td className="text-right py-2 px-2 font-mono tabular-nums text-ink-secondary">
                          {stmt.totalAssets ? `$${formatNumber(stmt.totalAssets / 1e6, 1)}M` : '—'}
                        </td>
                        <td className="text-right py-2 px-2 font-mono tabular-nums text-ink-secondary">
                          {stmt.totalLiabilities ? `$${formatNumber(stmt.totalLiabilities / 1e6, 1)}M` : '—'}
                        </td>
                      </>
                    )}
                    {activeStatement === 'cashFlow' && (
                      <>
                        <td className={`text-right py-2 px-2 font-mono tabular-nums ${
                          stmt.operatingCashFlow && stmt.operatingCashFlow > 0 ? 'text-positive' : stmt.operatingCashFlow && stmt.operatingCashFlow < 0 ? 'text-negative' : 'text-ink-secondary'
                        }`}>
                          {stmt.operatingCashFlow ? `$${formatNumber(stmt.operatingCashFlow / 1e6, 1)}M` : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
