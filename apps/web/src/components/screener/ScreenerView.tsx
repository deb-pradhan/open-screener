import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
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
import { prefetchTickerData } from '@/main';
import type { StockIndicators } from '@screener/shared';

export function ScreenerView() {
  const { presetId } = useParams<{ presetId: string }>();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const pageSize = 50;

  const activePreset = presetId || 'highVolume';

  const { data: presets } = usePresets();
  const { data: results, isLoading, error, refetch } = usePresetScreener(
    activePreset,
    page,
    pageSize
  );

  const handlePresetChange = (newPreset: string) => {
    navigate(`/screener/${newPreset}`);
    setPage(1);
  };

  const handleRowClick = (symbol: string) => {
    navigate(`/ticker/${symbol}`);
  };

  const handleRowHover = (symbol: string) => {
    prefetchTickerData(symbol);
  };

  const handleKeyDown = (e: React.KeyboardEvent, stocks: StockIndicators[]) => {
    if (e.key === 'Enter' && focusedRow !== null && stocks[focusedRow]) {
      navigate(`/ticker/${stocks[focusedRow].symbol}`);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedRow(prev => Math.min((prev ?? -1) + 1, stocks.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedRow(prev => Math.max((prev ?? 1) - 1, 0));
    }
  };

  const columns = useMemo<ColumnDef<StockIndicators>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: () => <span className="text-[10px] sm:text-label">STOCK</span>,
        cell: ({ row }) => {
          const logo = row.original.logo;
          const name = row.original.name;
          const symbol = row.getValue('symbol') as string;
          
          return (
            <div className="flex items-center gap-2 sm:gap-3">
              {logo ? (
                <img 
                  src={logo} 
                  alt={symbol}
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain bg-surface-subtle border border-border-element flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-surface-subtle border border-border-element flex items-center justify-center text-[8px] sm:text-[10px] font-mono text-ink-secondary flex-shrink-0">
                  {symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-mono text-[11px] sm:text-data text-ink-primary">{symbol}</div>
                {name && name !== symbol && (
                  <div className="text-[10px] sm:text-[11px] text-ink-tertiary truncate max-w-[80px] sm:max-w-[140px]">
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
        <CardContent className="py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left: Preset selector + results count */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-label text-ink-secondary flex-shrink-0">PRESET</span>
                <Select value={activePreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-full sm:w-[200px]">
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
                <Badge variant="outline" className="w-fit">
                  {results.total} results
                </Badge>
              )}
            </div>
            
            {/* Right: Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <ChevronRight className="h-4 w-4 text-accent-main" strokeWidth={1.5} />
            Screener Results
          </CardTitle>
          <p className="text-[10px] text-ink-tertiary">Click a row to view details</p>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-center py-8 sm:py-12 text-signal-error text-sm px-4">
              Error loading results: {error.message}
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 sm:py-12 text-ink-tertiary">
              <div className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            </div>
          ) : !results || results.stocks.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-ink-tertiary text-sm px-4">
              No stocks match the current filter criteria
            </div>
          ) : (
            <>
              <div 
                className="overflow-x-auto"
                onKeyDown={(e) => handleKeyDown(e, results.stocks)}
                tabIndex={0}
              >
                <table className="w-full min-w-[600px] sm:min-w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-y border-border-grid bg-surface-subtle">
                        {headerGroup.headers.map((header, idx) => {
                          // Hide SMA columns on mobile (indices 5, 6, 7)
                          const isHiddenMobile = idx >= 5;
                          return (
                            <th
                              key={header.id}
                              className={`px-2 sm:px-4 py-2 sm:py-3 text-left ${
                                idx === 0 ? 'sticky left-0 bg-surface-subtle z-10' : ''
                              } ${isHiddenMobile ? 'hidden md:table-cell' : ''}`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row, rowIdx) => (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row.original.symbol)}
                        onMouseEnter={() => handleRowHover(row.original.symbol)}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleRowClick(row.original.symbol)}
                        className={`border-b border-border-element cursor-pointer hover:bg-surface-subtle transition-colors ${
                          focusedRow === rowIdx ? 'bg-accent-subtle/50' : ''
                        }`}
                      >
                        {row.getVisibleCells().map((cell, idx) => {
                          // Hide SMA columns on mobile (indices 5, 6, 7)
                          const isHiddenMobile = idx >= 5;
                          return (
                            <td 
                              key={cell.id} 
                              className={`px-2 sm:px-4 py-2 sm:py-3 ${
                                idx === 0 ? 'sticky left-0 bg-surface-card z-10' : ''
                              } ${isHiddenMobile ? 'hidden md:table-cell' : ''}`}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-border-element">
                <span className="text-[10px] sm:text-label text-ink-tertiary order-2 sm:order-1">
                  PAGE {page} OF {totalPages}
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex-1 sm:flex-none"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex-1 sm:flex-none"
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
