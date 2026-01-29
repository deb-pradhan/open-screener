import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTickerNews } from '@/hooks/useTickerData';
import { RefreshCw, Newspaper, ExternalLink } from 'lucide-react';

interface TickerNewsProps {
  symbol: string;
}

export function TickerNews({ symbol }: TickerNewsProps) {
  const { data, isLoading, error } = useTickerNews(symbol);

  if (error) {
    return (
      <Card className="border-signal-error/20">
        <CardContent className="py-8 text-center text-signal-error">
          Failed to load news
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-ink-tertiary">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading news...
        </CardContent>
      </Card>
    );
  }

  const articles = data?.data?.articles || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Newspaper className="h-4 w-4 text-accent-main" />
          Latest News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {articles.length === 0 ? (
          <div className="py-8 text-center text-ink-tertiary">
            No recent news available
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <article 
                key={article.id}
                className="group border-b border-border-element pb-4 last:border-0 last:pb-0"
              >
                <div className="flex gap-4">
                  {article.imageUrl && (
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="w-20 h-14 object-cover bg-surface-subtle rounded flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={article.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group-hover:text-accent-main transition-colors"
                    >
                      <h3 className="text-sm font-medium text-ink-primary line-clamp-2">
                        {article.title}
                      </h3>
                    </a>
                    {article.description && (
                      <p className="text-xs text-ink-tertiary mt-1 line-clamp-2">
                        {article.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-ink-tertiary">
                        {article.publisher?.name || 'Unknown Source'}
                      </span>
                      <span className="text-[10px] text-ink-tertiary">
                        {formatTimeAgo(article.publishedAt)}
                      </span>
                      {article.articleUrl && (
                        <a
                          href={article.articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-accent-main hover:underline inline-flex items-center gap-1"
                        >
                          Read more
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
