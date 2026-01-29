import { Card, CardContent } from '@/components/ui/card';

export function TickerPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
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
      
      {/* Tabs skeleton */}
      <div className="h-10 w-full border-b border-border-grid flex gap-4">
        {['Overview', 'Financials', 'News', 'Dividends'].map((tab) => (
          <div key={tab} className="h-4 w-20 bg-surface-subtle rounded" />
        ))}
      </div>
      
      {/* Content skeleton - metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <div className="h-3 w-20 bg-surface-subtle rounded" />
              <div className="h-6 w-28 bg-surface-subtle rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Description skeleton */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="h-3 w-24 bg-surface-subtle rounded" />
          <div className="h-4 w-full bg-surface-subtle rounded" />
          <div className="h-4 w-full bg-surface-subtle rounded" />
          <div className="h-4 w-3/4 bg-surface-subtle rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
