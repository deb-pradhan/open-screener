import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePresetScreener, usePresets } from '@/hooks/useScreener';
import { formatNumber, formatPrice, formatPercent } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, ChevronRight } from 'lucide-react';
import type { StockIndicators } from '@screener/shared';

interface ScreenerViewProps {
  activePreset: string;
  onPresetChange: (preset: string) => void;
}

export function ScreenerView({ activePreset, onPresetChange }: ScreenerViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: presets } = usePresets();
  const { data: results, isLoading, error, refetch } = usePresetScreener(
    activePreset,
    page,
    pageSize
  );

  const columns = useMemo<ColumnDef<StockIndicators>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: () => <span className="text-label">STOCK</span>,
        cell: ({ row }) => {
          const logo = row.original.logo;
          const name = row.original.name;
          const symbol = row.getValue('symbol') as string;
          
          return (
            <div className="flex items-center gap-3">
              {logo ? (
                <img 
                  src={logo} 
                  alt={symbol}
                  className="w-8 h-8 object-contain bg-surface-subtle border border-border-element"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-surface-subtle border border-border-element flex items-center justify-center text-[10px] font-mono text-ink-secondary">
                  {symbol.slice(0, 2)}
                </div>
              )}
              <div>
                <div className="font-mono text-data text-ink-primary">{symbol}</div>
                {name && name !== symbol && (
                  <div className="text-[11px] text-ink-tertiary truncate max-w-[140px]">
                    {name}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'price',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-label hover:text-accent-main transition-colors"
          >
            PRICE
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-ink-tertiary" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-data tabular-nums">
            {formatPrice(row.getValue('price'))}
          </span>
        ),
      },
      {
        accessorKey: 'changePercent',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-label hover:text-accent-main transition-colors"
          >
            CHANGE
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-ink-tertiary" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const value = row.getValue('changePercent') as number;
          return (
            <span className={`font-mono text-data tabular-nums ${value >= 0 ? 'text-positive' : 'text-negative'}`}>
              {formatPercent(value)}
            </span>
          );
        },
      },
      {
        accessorKey: 'volume',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-label hover:text-accent-main transition-colors"
          >
            VOLUME
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-ink-tertiary" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-data tabular-nums">
            {formatNumber(row.getValue('volume'), 0)}
          </span>
        ),
      },
      {
        accessorKey: 'rsi14',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-label hover:text-accent-main transition-colors"
          >
            RSI(14)
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-ink-tertiary" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const value = row.getValue('rsi14') as number | undefined;
          if (value === undefined) return <span className="text-ink-tertiary">—</span>;
          
          let variant: 'secondary' | 'success' | 'destructive' = 'secondary';
          if (value < 30) variant = 'success';
          else if (value > 70) variant = 'destructive';
          
          return (
            <Badge variant={variant} className="font-mono">
              {value.toFixed(1)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'sma20',
        header: () => <span className="text-label">SMA20</span>,
        cell: ({ row }) => {
          const value = row.getValue('sma20') as number | undefined;
          return (
            <span className="font-mono text-data tabular-nums text-ink-secondary">
              {value ? formatPrice(value) : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'sma50',
        header: () => <span className="text-label">SMA50</span>,
        cell: ({ row }) => {
          const value = row.getValue('sma50') as number | undefined;
          return (
            <span className="font-mono text-data tabular-nums text-ink-secondary">
              {value ? formatPrice(value) : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'sma200',
        header: () => <span className="text-label">SMA200</span>,
        cell: ({ row }) => {
          const value = row.getValue('sma200') as number | undefined;
          return (
            <span className="font-mono text-data tabular-nums text-ink-secondary">
              {value ? formatPrice(value) : '—'}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: results?.stocks || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const totalPages = results ? Math.ceil(results.total / pageSize) : 0;

  return (
    <div className="space-y-0">
      {/* Filters Bar */}
      <Card className="border-b-0">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-label text-ink-secondary">PRESET</span>
                <Select value={activePreset} onValueChange={onPresetChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets?.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {results && (
                <Badge variant="outline">
                  {results.total} results
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-accent-main" strokeWidth={1.5} />
            Screener Results
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-center py-12 text-signal-error">
              Error loading results: {error.message}
            </div>
          ) : isLoading ? (
            <div className="text-center py-12 text-ink-tertiary">
              <div className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            </div>
          ) : !results || results.stocks.length === 0 ? (
            <div className="text-center py-12 text-ink-tertiary">
              No stocks match the current filter criteria
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-y border-border-grid bg-surface-subtle">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-left"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border-element hover:bg-accent-subtle/50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-element">
                <span className="text-label text-ink-tertiary">
                  PAGE {page} OF {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
