import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatPercent } from '@/lib/utils';
import { ChevronRight, TrendingUp, DollarSign, Activity, BarChart2 } from 'lucide-react';
import type { LatestSnapshotData, FinancialRatios, CompanyDetails } from '@screener/shared';

interface TickerOverviewProps {
  snapshot: LatestSnapshotData | null;
  ratios: FinancialRatios | null;
  company: CompanyDetails | null;
}

export function TickerOverview({ snapshot, ratios, company }: TickerOverviewProps) {
  return (
    <div className="space-y-4">
      {/* Technical Indicators */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-accent-main" />
            Technical Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              label="RSI (14)"
              value={snapshot?.rsi14?.toFixed(1)}
              badge={
                snapshot?.rsi14 
                  ? snapshot.rsi14 < 30 
                    ? { text: 'Oversold', variant: 'success' as const }
                    : snapshot.rsi14 > 70 
                      ? { text: 'Overbought', variant: 'destructive' as const }
                      : undefined
                  : undefined
              }
            />
            <MetricCard label="SMA 20" value={snapshot?.sma20?.toFixed(2)} />
            <MetricCard label="SMA 50" value={snapshot?.sma50?.toFixed(2)} />
            <MetricCard label="SMA 200" value={snapshot?.sma200?.toFixed(2)} />
            <MetricCard label="EMA 12" value={snapshot?.ema12?.toFixed(2)} />
            <MetricCard label="EMA 26" value={snapshot?.ema26?.toFixed(2)} />
            <MetricCard label="MACD" value={snapshot?.macdValue?.toFixed(4)} />
            <MetricCard label="MACD Signal" value={snapshot?.macdSignal?.toFixed(4)} />
          </div>
        </CardContent>
      </Card>

      {/* Valuation Ratios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-accent-main" />
            Valuation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="P/E Ratio" value={ratios?.peRatio?.toFixed(2)} />
            <MetricCard label="P/B Ratio" value={ratios?.pbRatio?.toFixed(2)} />
            <MetricCard label="P/S Ratio" value={ratios?.psRatio?.toFixed(2)} />
            <MetricCard label="EV/EBITDA" value={ratios?.evToEbitda?.toFixed(2)} />
            <MetricCard label="PEG Ratio" value={ratios?.pegRatio?.toFixed(2)} />
            <MetricCard 
              label="Div Yield" 
              value={snapshot?.dividendYield ? `${snapshot.dividendYield.toFixed(2)}%` : undefined} 
            />
            <MetricCard 
              label="Market Cap" 
              value={snapshot?.marketCap ? `$${formatNumber(snapshot.marketCap / 1e9, 2)}B` : undefined} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Profitability */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-accent-main" />
            Profitability & Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
              label="Gross Margin" 
              value={ratios?.grossMargin ? `${ratios.grossMargin.toFixed(1)}%` : undefined} 
            />
            <MetricCard 
              label="Operating Margin" 
              value={ratios?.operatingMargin ? `${ratios.operatingMargin.toFixed(1)}%` : undefined} 
            />
            <MetricCard 
              label="Net Margin" 
              value={ratios?.netMargin ? `${ratios.netMargin.toFixed(1)}%` : undefined} 
            />
            <MetricCard 
              label="ROE" 
              value={ratios?.roe ? `${ratios.roe.toFixed(1)}%` : undefined} 
            />
            <MetricCard 
              label="ROA" 
              value={ratios?.roa ? `${ratios.roa.toFixed(1)}%` : undefined} 
            />
            <MetricCard 
              label="Revenue Growth (YoY)" 
              value={snapshot?.revenueGrowthYoy ? formatPercent(snapshot.revenueGrowthYoy) : undefined}
              positive={snapshot?.revenueGrowthYoy ? snapshot.revenueGrowthYoy > 0 : undefined}
            />
            <MetricCard 
              label="EPS Growth (YoY)" 
              value={snapshot?.epsGrowthYoy ? formatPercent(snapshot.epsGrowthYoy) : undefined}
              positive={snapshot?.epsGrowthYoy ? snapshot.epsGrowthYoy > 0 : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Financial Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="h-4 w-4 text-accent-main" />
            Financial Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
              label="Debt/Equity" 
              value={ratios?.debtToEquity?.toFixed(2)} 
            />
            <MetricCard 
              label="Current Ratio" 
              value={ratios?.currentRatio?.toFixed(2)} 
            />
            <MetricCard 
              label="Quick Ratio" 
              value={ratios?.quickRatio?.toFixed(2)} 
            />
            <MetricCard 
              label="Interest Coverage" 
              value={ratios?.interestCoverage?.toFixed(2)} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      {company?.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ChevronRight className="h-4 w-4 text-accent-main" />
              About {snapshot?.name || snapshot?.symbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-secondary leading-relaxed">
              {company.description}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-element">
              {company.sicDescription && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Industry</div>
                  <div className="text-sm text-ink-primary">{company.sicDescription}</div>
                </div>
              )}
              {company.totalEmployees && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Employees</div>
                  <div className="text-sm text-ink-primary">{formatNumber(company.totalEmployees, 0)}</div>
                </div>
              )}
              {company.listDate && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Listed</div>
                  <div className="text-sm text-ink-primary">{company.listDate}</div>
                </div>
              )}
              {company.address?.city && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Headquarters</div>
                  <div className="text-sm text-ink-primary">
                    {company.address.city}, {company.address.state || company.address.country}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value?: string;
  badge?: { text: string; variant: 'success' | 'destructive' | 'secondary' };
  positive?: boolean;
}

function MetricCard({ label, value, badge, positive }: MetricCardProps) {
  return (
    <div>
      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-sm tabular-nums ${
          value 
            ? positive !== undefined 
              ? positive ? 'text-positive' : 'text-negative'
              : 'text-ink-primary'
            : 'text-ink-tertiary'
        }`}>
          {value || '—'}
        </span>
        {badge && (
          <Badge variant={badge.variant} className="text-[9px] px-1.5 py-0">
            {badge.text}
          </Badge>
        )}
      </div>
    </div>
  );
}
