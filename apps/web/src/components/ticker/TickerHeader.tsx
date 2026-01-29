import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatPercent, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import type { LatestSnapshotData, CompanyDetails } from '@screener/shared';

interface TickerHeaderProps {
  snapshot: LatestSnapshotData | null;
  company: CompanyDetails | null;
}

export function TickerHeader({ snapshot, company }: TickerHeaderProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-ink-tertiary">
          No data available for this symbol
        </CardContent>
      </Card>
    );
  }

  const isPositive = (snapshot.changePercent || 0) >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Logo and basic info */}
          <div className="flex items-start gap-4 flex-1">
            {snapshot.logoUrl ? (
              <img
                src={snapshot.logoUrl}
                alt={snapshot.symbol}
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain bg-surface-subtle border border-border-element"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-surface-subtle border border-border-element flex items-center justify-center text-lg font-mono text-ink-secondary">
                {snapshot.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-medium text-ink-primary">
                  {snapshot.symbol}
                </h1>
                {snapshot.marketCap && (
                  <Badge variant="outline" className="text-[10px]">
                    ${formatNumber(snapshot.marketCap / 1e9, 2)}B
                  </Badge>
                )}
              </div>
              <p className="text-sm text-ink-secondary truncate mt-0.5">
                {snapshot.name || snapshot.symbol}
              </p>
              {company?.homepageUrl && (
                <a
                  href={company.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-main hover:underline mt-1"
                >
                  {new URL(company.homepageUrl).hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Price and change */}
          <div className="text-left sm:text-right">
            <div className="text-2xl sm:text-3xl font-mono tabular-nums text-ink-primary">
              {formatPrice(snapshot.price)}
            </div>
            <div className={`flex items-center gap-1.5 sm:justify-end mt-1 ${
              isPositive ? 'text-positive' : 'text-negative'
            }`}>
              <TrendIcon className="h-4 w-4" />
              <span className="font-mono text-sm tabular-nums">
                {formatPercent(snapshot.changePercent || 0)}
              </span>
            </div>
            {snapshot.updatedAt && (
              <p className="text-[10px] text-ink-tertiary mt-2">
                Last updated: {new Date(snapshot.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-element">
          <QuickStat label="OPEN" value={formatPrice(snapshot.open || 0)} />
          <QuickStat label="HIGH" value={formatPrice(snapshot.high || 0)} />
          <QuickStat label="LOW" value={formatPrice(snapshot.low || 0)} />
          <QuickStat label="VOLUME" value={formatNumber(snapshot.volume, 0)} />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm text-ink-primary tabular-nums">{value}</div>
    </div>
  );
}
