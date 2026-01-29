import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatPercent, formatPrice } from '@/lib/utils';
import { TickerChart } from './TickerChart';
import { 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  BarChart2, 
  Calendar,
  Users,
  Target,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart,
} from 'lucide-react';
import type { 
  LatestSnapshotData, 
  FinancialRatios, 
  CompanyDetails,
  EarningsData,
  AnalystRecommendation,
  UpgradeDowngrade,
  HoldersBreakdown,
  InsiderTransaction,
  InstitutionalHolder,
} from '@screener/shared';

interface TickerOverviewProps {
  symbol: string;
  snapshot: LatestSnapshotData | null;
  ratios: FinancialRatios | null;
  company: CompanyDetails | null;
  earnings?: EarningsData | null;
  recommendations?: AnalystRecommendation[] | null;
  upgradeDowngrades?: UpgradeDowngrade[] | null;
  holdersBreakdown?: HoldersBreakdown | null;
  insiderTransactions?: InsiderTransaction[] | null;
  institutionalHolders?: InstitutionalHolder[] | null;
}

export function TickerOverview({ 
  symbol,
  snapshot, 
  ratios, 
  company,
  earnings,
  recommendations,
  upgradeDowngrades,
  holdersBreakdown,
  insiderTransactions,
  institutionalHolders,
}: TickerOverviewProps) {
  // Get the most recent recommendation period
  const currentRec = recommendations?.[0];
  const totalAnalysts = currentRec 
    ? currentRec.strongBuy + currentRec.buy + currentRec.hold + currentRec.sell + currentRec.strongSell
    : 0;

  return (
    <div className="space-y-4">
      {/* Price Chart */}
      <TickerChart symbol={symbol} />

      {/* Trading Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="h-4 w-4 text-accent-main" />
            Trading Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
              label="Previous Close" 
              value={snapshot?.previousClose ? formatPrice(snapshot.previousClose) : undefined} 
            />
            <MetricCard 
              label="Day Range" 
              value={snapshot?.low && snapshot?.high 
                ? `${formatPrice(snapshot.low)} - ${formatPrice(snapshot.high)}` 
                : undefined
              } 
            />
            <MetricCard 
              label="52 Week Range" 
              value={snapshot?.fiftyTwoWeekLow && snapshot?.fiftyTwoWeekHigh 
                ? `${formatPrice(snapshot.fiftyTwoWeekLow)} - ${formatPrice(snapshot.fiftyTwoWeekHigh)}` 
                : undefined
              } 
            />
            <MetricCard 
              label="52 Week Change" 
              value={snapshot?.fiftyTwoWeekChange ? formatPercent(snapshot.fiftyTwoWeekChange) : undefined}
              positive={snapshot?.fiftyTwoWeekChange ? snapshot.fiftyTwoWeekChange > 0 : undefined}
            />
            <MetricCard 
              label="50 Day Avg" 
              value={snapshot?.fiftyDayAverage ? formatPrice(snapshot.fiftyDayAverage) : undefined} 
            />
            <MetricCard 
              label="200 Day Avg" 
              value={snapshot?.twoHundredDayAverage ? formatPrice(snapshot.twoHundredDayAverage) : undefined} 
            />
            <MetricCard 
              label="Avg Volume" 
              value={snapshot?.averageVolume ? formatNumber(snapshot.averageVolume, 0) : undefined} 
            />
            <MetricCard 
              label="Beta" 
              value={snapshot?.beta?.toFixed(2)} 
            />
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
            <MetricCard label="P/E (TTM)" value={ratios?.peRatio?.toFixed(2)} />
            <MetricCard label="P/E (Forward)" value={ratios?.forwardPE?.toFixed(2)} />
            <MetricCard label="P/B Ratio" value={ratios?.pbRatio?.toFixed(2)} />
            <MetricCard label="P/S Ratio" value={ratios?.psRatio?.toFixed(2)} />
            <MetricCard label="EV/EBITDA" value={ratios?.evToEbitda?.toFixed(2)} />
            <MetricCard label="EV/Revenue" value={ratios?.evToRevenue?.toFixed(2)} />
            <MetricCard label="PEG Ratio" value={ratios?.pegRatio?.toFixed(2)} />
            <MetricCard 
              label="Div Yield" 
              value={snapshot?.dividendYield ? `${snapshot.dividendYield.toFixed(2)}%` : undefined} 
            />
            <MetricCard 
              label="Market Cap" 
              value={snapshot?.marketCap ? `$${formatNumber(snapshot.marketCap / 1e9, 2)}B` : undefined} 
            />
            <MetricCard 
              label="Enterprise Value" 
              value={snapshot?.enterpriseValue ? `$${formatNumber(snapshot.enterpriseValue / 1e9, 2)}B` : undefined} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Earnings Per Share */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-accent-main" />
            Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
              label="EPS (TTM)" 
              value={snapshot?.trailingEps ? `$${snapshot.trailingEps.toFixed(2)}` : undefined} 
            />
            <MetricCard 
              label="EPS (Forward)" 
              value={snapshot?.forwardEps ? `$${snapshot.forwardEps.toFixed(2)}` : undefined} 
            />
            <MetricCard 
              label="Next Earnings" 
              value={earnings?.earningsDate 
                ? new Date(earnings.earningsDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric',
                  })
                : undefined
              }
              badge={earnings?.isEarningsDateEstimate ? { text: 'Est', variant: 'secondary' as const } : undefined}
            />
            <MetricCard 
              label="Revenue/Share" 
              value={snapshot?.revenuePerShare ? `$${snapshot.revenuePerShare.toFixed(2)}` : undefined} 
            />
          </div>

          {/* Earnings History */}
          {earnings?.earningsHistory && earnings.earningsHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-element">
              <h4 className="text-xs text-ink-tertiary uppercase tracking-wider mb-3">Recent Earnings</h4>
              <div className="space-y-2">
                {earnings.earningsHistory.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-ink-secondary">{item.quarter}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-ink-tertiary">
                        Est: ${item.epsEstimate?.toFixed(2) ?? '—'}
                      </span>
                      <span className="text-ink-primary font-mono">
                        Act: ${item.epsActual?.toFixed(2) ?? '—'}
                      </span>
                      {item.surprisePercent !== undefined && (
                        <Badge 
                          variant={item.surprisePercent >= 0 ? 'success' : 'destructive'}
                          className="text-[10px] px-1.5"
                        >
                          {item.surprisePercent >= 0 ? '+' : ''}{item.surprisePercent.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analyst Ratings */}
      {(currentRec || ratios?.targetMeanPrice) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-accent-main" />
              Analyst Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Recommendation breakdown */}
              {currentRec && totalAnalysts > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-ink-secondary">
                      {totalAnalysts} Analyst{totalAnalysts !== 1 ? 's' : ''}
                    </span>
                    {ratios?.recommendationKey && (
                      <Badge variant={getRecommendationVariant(ratios.recommendationKey)}>
                        {ratios.recommendationKey.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <RatingBar label="Strong Buy" count={currentRec.strongBuy} total={totalAnalysts} color="bg-positive" />
                    <RatingBar label="Buy" count={currentRec.buy} total={totalAnalysts} color="bg-positive/70" />
                    <RatingBar label="Hold" count={currentRec.hold} total={totalAnalysts} color="bg-yellow-500" />
                    <RatingBar label="Sell" count={currentRec.sell} total={totalAnalysts} color="bg-negative/70" />
                    <RatingBar label="Strong Sell" count={currentRec.strongSell} total={totalAnalysts} color="bg-negative" />
                  </div>
                </div>
              )}

              {/* Price targets */}
              {ratios?.targetMeanPrice && (
                <div>
                  <h4 className="text-xs text-ink-tertiary uppercase tracking-wider mb-3">Price Targets</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-secondary">Low</span>
                      <span className="font-mono text-sm">{formatPrice(ratios.targetLowPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-secondary">Average</span>
                      <span className="font-mono text-sm font-medium text-ink-primary">{formatPrice(ratios.targetMeanPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-secondary">High</span>
                      <span className="font-mono text-sm">{formatPrice(ratios.targetHighPrice || 0)}</span>
                    </div>
                    {snapshot?.price && ratios.targetMeanPrice && (
                      <div className="pt-2 border-t border-border-element">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-ink-secondary">Upside/Downside</span>
                          <span className={`font-mono text-sm font-medium ${
                            ((ratios.targetMeanPrice - snapshot.price) / snapshot.price) >= 0 
                              ? 'text-positive' 
                              : 'text-negative'
                          }`}>
                            {formatPercent(((ratios.targetMeanPrice - snapshot.price) / snapshot.price) * 100)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Upgrades/Downgrades */}
            {upgradeDowngrades && upgradeDowngrades.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border-element">
                <h4 className="text-xs text-ink-tertiary uppercase tracking-wider mb-3">Recent Rating Changes</h4>
                <div className="space-y-2">
                  {upgradeDowngrades.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {item.action === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-positive" />}
                        {item.action === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-negative" />}
                        {item.action !== 'up' && item.action !== 'down' && <Minus className="h-3.5 w-3.5 text-ink-tertiary" />}
                        <span className="text-ink-secondary">{item.firm}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.fromGrade && (
                          <>
                            <span className="text-ink-tertiary">{item.fromGrade}</span>
                            <span className="text-ink-tertiary">→</span>
                          </>
                        )}
                        <span className="text-ink-primary font-medium">{item.toGrade}</span>
                        <span className="text-[10px] text-ink-tertiary">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profitability & Growth */}
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
              label="EBITDA Margin" 
              value={ratios?.ebitdaMargin ? `${ratios.ebitdaMargin.toFixed(1)}%` : undefined} 
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
              label="Revenue Growth" 
              value={ratios?.revenueGrowth ? formatPercent(ratios.revenueGrowth) : undefined}
              positive={ratios?.revenueGrowth ? ratios.revenueGrowth > 0 : undefined}
            />
            <MetricCard 
              label="Earnings Growth" 
              value={ratios?.earningsGrowth ? formatPercent(ratios.earningsGrowth) : undefined}
              positive={ratios?.earningsGrowth ? ratios.earningsGrowth > 0 : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Financial Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-accent-main" />
            Financial Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
              label="Total Cash" 
              value={snapshot?.totalCash ? `$${formatNumber(snapshot.totalCash / 1e9, 2)}B` : undefined} 
            />
            <MetricCard 
              label="Total Debt" 
              value={snapshot?.totalDebt ? `$${formatNumber(snapshot.totalDebt / 1e9, 2)}B` : undefined} 
            />
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
              label="Book Value/Share" 
              value={snapshot?.bookValue ? `$${snapshot.bookValue.toFixed(2)}` : undefined} 
            />
            <MetricCard 
              label="Free Cash Flow" 
              value={ratios?.freeCashFlow ? `$${formatNumber(ratios.freeCashFlow / 1e9, 2)}B` : undefined} 
            />
            <MetricCard 
              label="Operating Cash Flow" 
              value={ratios?.operatingCashFlow ? `$${formatNumber(ratios.operatingCashFlow / 1e9, 2)}B` : undefined} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Share Statistics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PieChart className="h-4 w-4 text-accent-main" />
            Share Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
              label="Shares Outstanding" 
              value={snapshot?.sharesOutstanding ? formatNumber(snapshot.sharesOutstanding / 1e6, 2) + 'M' : undefined} 
            />
            <MetricCard 
              label="Float" 
              value={snapshot?.floatShares ? formatNumber(snapshot.floatShares / 1e6, 2) + 'M' : undefined} 
            />
            <MetricCard 
              label="Shares Short" 
              value={snapshot?.sharesShort ? formatNumber(snapshot.sharesShort / 1e6, 2) + 'M' : undefined} 
            />
            <MetricCard 
              label="Short % of Float" 
              value={snapshot?.shortPercentOfFloat ? `${snapshot.shortPercentOfFloat.toFixed(2)}%` : undefined} 
            />
            <MetricCard 
              label="Short Ratio" 
              value={snapshot?.shortRatio?.toFixed(2)} 
            />
            {holdersBreakdown && (
              <>
                <MetricCard 
                  label="% Held by Insiders" 
                  value={holdersBreakdown.insidersPercentHeld 
                    ? `${(holdersBreakdown.insidersPercentHeld * 100).toFixed(2)}%` 
                    : undefined
                  } 
                />
                <MetricCard 
                  label="% Held by Institutions" 
                  value={holdersBreakdown.institutionsPercentHeld 
                    ? `${(holdersBreakdown.institutionsPercentHeld * 100).toFixed(2)}%` 
                    : undefined
                  } 
                />
                <MetricCard 
                  label="# of Institutions" 
                  value={holdersBreakdown.institutionsCount?.toLocaleString()} 
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Institutional Holders */}
      {institutionalHolders && institutionalHolders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-accent-main" />
              Top Institutional Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {institutionalHolders.slice(0, 5).map((holder, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border-element last:border-0">
                  <span className="text-ink-secondary truncate max-w-[200px]">{holder.holder}</span>
                  <div className="flex items-center gap-4 text-right">
                    <span className="text-ink-tertiary text-xs">
                      {(holder.pctHeld * 100).toFixed(2)}%
                    </span>
                    <span className="font-mono text-ink-primary">
                      {formatNumber(holder.shares / 1e6, 2)}M
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insider Transactions */}
      {insiderTransactions && insiderTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-accent-main" />
              Recent Insider Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insiderTransactions.slice(0, 5).map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border-element last:border-0">
                  <div>
                    <div className="text-ink-primary">{tx.filerName}</div>
                    <div className="text-xs text-ink-tertiary">{tx.filerRelation}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono ${tx.shares > 0 ? 'text-positive' : 'text-negative'}`}>
                      {tx.shares > 0 ? '+' : ''}{formatNumber(tx.shares, 0)}
                    </div>
                    <div className="text-xs text-ink-tertiary">
                      {new Date(tx.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {company.sector && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Sector</div>
                  <div className="text-sm text-ink-primary">{company.sector}</div>
                </div>
              )}
              {company.industry && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Industry</div>
                  <div className="text-sm text-ink-primary">{company.industry}</div>
                </div>
              )}
              {company.totalEmployees && (
                <div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-wider">Employees</div>
                  <div className="text-sm text-ink-primary">{formatNumber(company.totalEmployees, 0)}</div>
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

            {/* Company Officers */}
            {company.companyOfficers && company.companyOfficers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border-element">
                <h4 className="text-xs text-ink-tertiary uppercase tracking-wider mb-3">Key Executives</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {company.companyOfficers.slice(0, 4).map((officer, i) => (
                    <div key={i} className="text-sm">
                      <div className="text-ink-primary font-medium">{officer.name}</div>
                      <div className="text-xs text-ink-tertiary">{officer.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Scores */}
            {company.overallRisk !== undefined && (
              <div className="mt-4 pt-4 border-t border-border-element">
                <h4 className="text-xs text-ink-tertiary uppercase tracking-wider mb-3">Governance Risk Scores</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <RiskScore label="Overall" score={company.overallRisk} />
                  <RiskScore label="Audit" score={company.auditRisk} />
                  <RiskScore label="Board" score={company.boardRisk} />
                  <RiskScore label="Compensation" score={company.compensationRisk} />
                  <RiskScore label="Shareholder Rights" score={company.shareHolderRightsRisk} />
                </div>
                <p className="text-[10px] text-ink-tertiary mt-2">Lower scores indicate lower risk (1-10 scale)</p>
              </div>
            )}
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

function RatingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-tertiary w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface-subtle rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-secondary w-6 text-right">{count}</span>
    </div>
  );
}

function RiskScore({ label, score }: { label: string; score?: number }) {
  if (score === undefined) return null;
  
  const getScoreColor = (s: number) => {
    if (s <= 3) return 'text-positive';
    if (s <= 6) return 'text-yellow-500';
    return 'text-negative';
  };

  return (
    <div className="text-center">
      <div className={`text-lg font-mono font-bold ${getScoreColor(score)}`}>{score}</div>
      <div className="text-[10px] text-ink-tertiary">{label}</div>
    </div>
  );
}

function getRecommendationVariant(key: string): 'success' | 'destructive' | 'secondary' {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('buy') || lowerKey === 'outperform' || lowerKey === 'overweight') {
    return 'success';
  }
  if (lowerKey.includes('sell') || lowerKey === 'underperform' || lowerKey === 'underweight') {
    return 'destructive';
  }
  return 'secondary';
}
