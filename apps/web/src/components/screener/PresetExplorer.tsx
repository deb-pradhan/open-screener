import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus, TrendingUp, Activity, BarChart3, Zap } from 'lucide-react';
import { PRESET_CATEGORIES, getPresetsByCategory, type PresetCategory } from '@screener/shared';

interface PresetExplorerProps {
  onPresetSelect: (presetId: string) => void;
  onCreateCustom: () => void;
}

const categoryIcons: Record<PresetCategory, React.ReactNode> = {
  technical: <Activity className="h-4 w-4" strokeWidth={1.5} />,
  moving_averages: <TrendingUp className="h-4 w-4" strokeWidth={1.5} />,
  price_volume: <BarChart3 className="h-4 w-4" strokeWidth={1.5} />,
  momentum: <Zap className="h-4 w-4" strokeWidth={1.5} />,
};

export function PresetExplorer({ onPresetSelect, onCreateCustom }: PresetExplorerProps) {
  return (
    <div className="space-y-0">
      {/* Page Header */}
      <Card className="border-b-0">
        <CardContent className="py-4 sm:py-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="text-base sm:text-h1 text-ink-primary">Stock Screens</h2>
              <p className="text-xs sm:text-body text-ink-secondary mt-0.5 sm:mt-1">
                Select a preset screen or create your own custom filter
              </p>
            </div>
            <Button onClick={onCreateCustom} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Create Custom Screen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {PRESET_CATEGORIES.map((category, idx) => {
          const presets = getPresetsByCategory(category.id);
          
          return (
            <Card key={category.id} className="relative">
              {/* Crosshair artifact at top-right - hidden on mobile */}
              {idx % 2 === 0 && idx < PRESET_CATEGORIES.length - 1 && (
                <span className="absolute -top-[1px] -right-[1px] text-accent-main font-mono text-[10px] z-10 bg-surface-card px-0.5 hidden lg:block">
                  +
                </span>
              )}
              
              <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                  <span className="text-accent-main">{categoryIcons[category.id]}</span>
                  {category.name}
                </CardTitle>
                <p className="text-[10px] sm:text-label text-ink-tertiary mt-0.5 sm:mt-1">
                  {category.description.toUpperCase()}
                </p>
              </CardHeader>
              
              <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => onPresetSelect(preset.id)}
                      className="group text-left p-3 sm:p-4 bg-surface-subtle border border-border-element hover:border-accent-main hover:bg-accent-subtle/30 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="text-xs sm:text-body font-medium text-ink-primary group-hover:text-accent-main transition-colors">
                              {preset.name}
                            </span>
                            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-ink-tertiary group-hover:text-accent-main group-hover:translate-x-0.5 transition-all flex-shrink-0" strokeWidth={1.5} />
                          </div>
                          <p className="text-[11px] sm:text-[12px] text-ink-tertiary mt-0.5 sm:mt-1 line-clamp-2">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* Filter preview - simplified on mobile */}
                      <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5">
                        {preset.conditions.slice(0, 2).map((condition, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-surface-card border border-border-element text-[9px] sm:text-[10px] font-mono text-ink-secondary"
                          >
                            <span className="hidden sm:inline">{condition.field.toUpperCase()}</span>
                            <span className="sm:hidden">{condition.field.slice(0, 3).toUpperCase()}</span>
                            {' '}{condition.operator} {Array.isArray(condition.value) ? condition.value.join('-') : formatValue(condition.value)}
                          </span>
                        ))}
                        {preset.conditions.length > 2 && (
                          <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono text-ink-tertiary">
                            +{preset.conditions.length - 2}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Popular Screens Section */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <ChevronRight className="h-4 w-4 text-accent-main" strokeWidth={1.5} />
            Popular Screens
          </CardTitle>
          <p className="text-[10px] sm:text-label text-ink-tertiary">
            COMMONLY USED BY TRADERS
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {['highVolume', 'topGainers', 'oversold', 'goldenCross', 'bullishMomentum'].map((presetId) => {
              const preset = getPresetsByCategory('technical').find(p => p.id === presetId) ||
                           getPresetsByCategory('moving_averages').find(p => p.id === presetId) ||
                           getPresetsByCategory('price_volume').find(p => p.id === presetId) ||
                           getPresetsByCategory('momentum').find(p => p.id === presetId);
              
              if (!preset) return null;
              
              return (
                <button
                  key={presetId}
                  onClick={() => onPresetSelect(presetId)}
                  className="group p-3 sm:p-4 bg-surface-subtle border border-border-element hover:border-accent-main hover:bg-accent-subtle/30 transition-all text-left active:scale-[0.98]"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-body font-medium text-ink-primary group-hover:text-accent-main transition-colors truncate">
                      {preset.name}
                    </span>
                    <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-ink-tertiary group-hover:text-accent-main flex-shrink-0" strokeWidth={1.5} />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}
