import { Card, CardContent } from '@/components/ui/card';

export function TickerPageSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-pulse">
      {/* Header skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-surface-subtle rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-32 bg-surface-subtle rounded" />
              <div className="h-4 w-48 bg-surface-subtle rounded" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-8 w-24 bg-surface-subtle rounded" />
              <div className="h-4 w-16 bg-surface-subtle rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Chart skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="h-[400px] bg-surface-subtle rounded" />
        </CardContent>
      </Card>
      
      {/* Metrics grid skeleton */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="h-5 w-36 bg-surface-subtle rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 bg-surface-subtle rounded" />
                <div className="h-5 w-20 bg-surface-subtle rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Financials skeleton */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="h-5 w-40 bg-surface-subtle rounded" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-surface-subtle rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* News skeleton */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="h-5 w-28 bg-surface-subtle rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-20 h-14 bg-surface-subtle rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full bg-surface-subtle rounded" />
                <div className="h-3 w-3/4 bg-surface-subtle rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
