import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useScreenerStore } from '@/stores/screenerStore';
import { Plus, X, Play, Trash2, ChevronRight, Settings2 } from 'lucide-react';
import type { FilterCondition, FilterOperator, StockIndicators } from '@screener/shared';

const FIELDS: Array<{ value: keyof StockIndicators; label: string }> = [
  { value: 'price', label: 'Price' },
  { value: 'volume', label: 'Volume' },
  { value: 'changePercent', label: 'Change %' },
  { value: 'rsi14', label: 'RSI (14)' },
  { value: 'sma20', label: 'SMA 20' },
  { value: 'sma50', label: 'SMA 50' },
  { value: 'sma200', label: 'SMA 200' },
  { value: 'ema12', label: 'EMA 12' },
  { value: 'ema26', label: 'EMA 26' },
];

const OPERATORS: Array<{ value: FilterOperator; label: string; symbol: string }> = [
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'Greater or equal', symbol: '≥' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'Less or equal', symbol: '≤' },
  { value: 'eq', label: 'Equal', symbol: '=' },
  { value: 'neq', label: 'Not equal', symbol: '≠' },
  { value: 'between', label: 'Between', symbol: '↔' },
];

export function FilterBuilder() {
  const {
    customConditions,
    addCondition,
    removeCondition,
    clearConditions,
  } = useScreenerStore();

  const [newCondition, setNewCondition] = useState<Partial<FilterCondition>>({
    field: 'rsi14',
    operator: 'lt',
    value: 30,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleAddCondition = () => {
    if (
      newCondition.field &&
      newCondition.operator &&
      newCondition.value !== undefined
    ) {
      addCondition(newCondition as FilterCondition);
      setNewCondition({
        field: 'rsi14',
        operator: 'lt',
        value: 30,
      });
    }
  };

  const handleRunScreener = async () => {
    if (customConditions.length === 0) return;

    setIsRunning(true);
    try {
      const response = await fetch('/api/screener/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conditions: customConditions,
          page: 1,
          pageSize: 50,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.data);
      }
    } catch (error) {
      console.error('Failed to run screener:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* Filter Builder Card */}
      <Card className="border-b-0">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Settings2 className="h-4 w-4 text-accent-main" strokeWidth={1.5} />
            Custom Filter Builder
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Build filter criteria to find stocks matching specific conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
          {/* Add New Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Field</Label>
              <Select
                value={newCondition.field as string}
                onValueChange={(value) =>
                  setNewCondition({ ...newCondition, field: value as keyof StockIndicators })
                }
              >
                <SelectTrigger className="h-9 sm:h-10">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Operator</Label>
              <Select
                value={newCondition.operator}
                onValueChange={(value) =>
                  setNewCondition({ ...newCondition, operator: value as FilterOperator })
                }
              >
                <SelectTrigger className="h-9 sm:h-10">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-accent-main">{op.symbol}</span>
                        <span className="truncate">{op.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Value</Label>
              <Input
                type="number"
                value={newCondition.value as number}
                onChange={(e) =>
                  setNewCondition({
                    ...newCondition,
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="Enter value"
                className="font-mono h-9 sm:h-10"
              />
            </div>

            <Button onClick={handleAddCondition} className="w-full sm:w-auto h-9 sm:h-10">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
              Add Condition
            </Button>
          </div>

          {/* Active Conditions */}
          {customConditions.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-ink-primary text-xs sm:text-sm">Active Conditions</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearConditions} 
                  className="text-signal-error hover:text-signal-error h-8 px-2 sm:px-3"
                >
                  <Trash2 className="h-3.5 w-3.5 sm:mr-2" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Clear All</span>
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {customConditions.map((condition, index) => {
                  const field = FIELDS.find((f) => f.value === condition.field);
                  const operator = OPERATORS.find((o) => o.value === condition.operator);
                  return (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-body font-normal"
                    >
                      <span className="text-ink-primary">{field?.label}</span>
                      <span className="mx-1 sm:mx-1.5 font-mono text-accent-main">{operator?.symbol}</span>
                      <span className="font-mono text-ink-primary">
                        {Array.isArray(condition.value)
                          ? `${condition.value[0]} – ${condition.value[1]}`
                          : condition.value}
                      </span>
                      <button
                        onClick={() => removeCondition(index)}
                        className="ml-1.5 sm:ml-2 text-ink-tertiary hover:text-signal-error transition-colors p-0.5"
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Run Button */}
          <div className="flex justify-end pt-3 sm:pt-4 border-t border-border-element">
            <Button
              onClick={handleRunScreener}
              disabled={customConditions.length === 0 || isRunning}
              className="w-full sm:w-auto"
            >
              <Play className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {isRunning ? 'Running...' : 'Run Screener'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {results && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ChevronRight className="h-4 w-4 text-accent-main" strokeWidth={1.5} />
              Results
            </CardTitle>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              {results.total} matches
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {results.stocks.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-ink-tertiary text-sm">
                No stocks match the current filter criteria
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-y border-border-grid bg-surface-subtle">
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-label sticky left-0 bg-surface-subtle z-10">SYMBOL</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-label">PRICE</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-label">CHANGE</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-label hidden sm:table-cell">VOLUME</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-label">RSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.stocks.map((stock: any) => (
                      <tr
                        key={stock.symbol}
                        className="border-b border-border-element hover:bg-accent-subtle/50 transition-colors"
                      >
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono text-[11px] sm:text-data text-ink-primary sticky left-0 bg-surface-card z-10">
                          {stock.symbol}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono text-[11px] sm:text-data tabular-nums">
                          ${stock.price?.toFixed(2) || '—'}
                        </td>
                        <td
                          className={`px-2 sm:px-4 py-2 sm:py-3 font-mono text-[11px] sm:text-data tabular-nums ${
                            stock.changePercent >= 0
                              ? 'text-positive'
                              : 'text-negative'
                          }`}
                        >
                          {stock.changePercent >= 0 ? '+' : ''}
                          {stock.changePercent?.toFixed(2) || '—'}%
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono text-[11px] sm:text-data tabular-nums text-ink-secondary hidden sm:table-cell">
                          {stock.volume?.toLocaleString() || '—'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          {stock.rsi14 ? (
                            <Badge 
                              variant={
                                stock.rsi14 < 30 ? 'success' : 
                                stock.rsi14 > 70 ? 'destructive' : 
                                'secondary'
                              }
                              className="font-mono text-[10px] sm:text-xs"
                            >
                              {stock.rsi14.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-ink-tertiary">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
