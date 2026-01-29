import { useState, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTickerCore } from '@/hooks/useTickerData';
import { TickerHeader } from '@/components/ticker/TickerHeader';
import { TickerOverview } from '@/components/ticker/TickerOverview';
import { TickerChart } from '@/components/ticker/TickerChart';
import { TickerFinancials } from '@/components/ticker/TickerFinancials';
import { TickerNews } from '@/components/ticker/TickerNews';
import { TickerDividends } from '@/components/ticker/TickerDividends';
import { SectionErrorBoundary } from '@/components/ticker/ErrorBoundary';
import { TickerPageSkeleton } from './TickerPageSkeleton';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function TickerDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: coreData, isLoading, error, refetch } = useTickerCore(symbol!);

  if (isLoading) {
    return <TickerPageSkeleton />;
  }

  if (error || !coreData?.success) {
    return (
      <Card className="border-signal-error/20">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-signal-error mx-auto mb-4" />
          <h2 className="text-lg font-medium text-ink-primary mb-2">
            {error?.message === 'Symbol not found' 
              ? `Symbol "${symbol}" not found`
              : 'Failed to load ticker data'
            }
          </h2>
          <p className="text-sm text-ink-tertiary mb-6">
            {error?.message === 'Symbol not found'
              ? 'This symbol may not exist or is not available in our database.'
              : 'There was an error loading the data. Please try again.'
            }
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { 
    snapshot, 
    company, 
    ratios, 
    earnings, 
    recommendations, 
    upgradeDowngrades,
    holdersBreakdown,
    insiderTransactions,
    institutionalHolders,
  } = coreData.data!;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Always visible header */}
      <TickerHeader snapshot={snapshot} company={company} />

      {/* Tab navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
          <TabsTrigger value="chart" className="flex-shrink-0">Chart</TabsTrigger>
          <TabsTrigger value="financials" className="flex-shrink-0">Financials</TabsTrigger>
          <TabsTrigger value="news" className="flex-shrink-0">News</TabsTrigger>
          <TabsTrigger value="dividends" className="flex-shrink-0">Dividends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SectionErrorBoundary>
            <TickerOverview
              snapshot={snapshot}
              ratios={ratios}
              company={company}
              earnings={earnings}
              recommendations={recommendations}
              upgradeDowngrades={upgradeDowngrades}
              holdersBreakdown={holdersBreakdown}
              insiderTransactions={insiderTransactions}
              institutionalHolders={institutionalHolders}
            />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <SectionErrorBoundary>
            <Suspense fallback={<ChartSkeleton />}>
              <TickerChart symbol={symbol!} />
            </Suspense>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="financials" className="mt-4">
          <SectionErrorBoundary>
            <Suspense fallback={<FinancialsSkeleton />}>
              <TickerFinancials symbol={symbol!} />
            </Suspense>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="news" className="mt-4">
          <SectionErrorBoundary>
            <Suspense fallback={<NewsSkeleton />}>
              <TickerNews symbol={symbol!} />
            </Suspense>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="dividends" className="mt-4">
          <SectionErrorBoundary>
            <Suspense fallback={<DividendsSkeleton />}>
              <TickerDividends symbol={symbol!} />
            </Suspense>
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Data freshness indicator */}
      {coreData.meta?.freshness && (
        <div className="flex justify-end">
          <p className="text-[10px] text-ink-tertiary">
            Last updated: {coreData.meta.freshness.snapshot 
              ? new Date(coreData.meta.freshness.snapshot).toLocaleString()
              : 'Unknown'
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Skeleton components for lazy-loaded sections
function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="h-[400px] bg-surface-subtle animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

function FinancialsSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="h-6 w-48 bg-surface-subtle animate-pulse rounded" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-surface-subtle animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NewsSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-20 h-14 bg-surface-subtle animate-pulse rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-full bg-surface-subtle animate-pulse rounded" />
              <div className="h-3 w-3/4 bg-surface-subtle animate-pulse rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DividendsSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="h-6 w-48 bg-surface-subtle animate-pulse rounded" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-surface-subtle animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
