import { useState } from 'react';
import { ScreenerView } from '@/components/screener/ScreenerView';
import { FilterBuilder } from '@/components/screener/FilterBuilder';
import { PresetExplorer } from '@/components/screener/PresetExplorer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { BarChart3, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewMode = 'explore' | 'screener' | 'custom';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('explore');
  const [activePreset, setActivePreset] = useState<string>('highVolume');
  const { isConnected, lastUpdate } = useWebSocket(activePreset);

  const handlePresetSelect = (presetId: string) => {
    setActivePreset(presetId);
    setViewMode('screener');
  };

  const handleCreateCustom = () => {
    setViewMode('custom');
  };

  const handleBackToExplore = () => {
    setViewMode('explore');
  };

  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col">
      {/* Header */}
      <header className="bg-surface-card border-b border-border-grid">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back button + Logo */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {viewMode !== 'explore' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToExplore}
                  className="flex-shrink-0 gap-1 sm:gap-2 px-2 sm:px-3"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}
              <button 
                onClick={handleBackToExplore}
                className="flex items-center gap-2 sm:gap-4 hover:opacity-80 transition-opacity min-w-0"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-main flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-ink-on-accent" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-h1 text-ink-primary truncate">Stock Screener</h1>
                  <p className="text-[9px] sm:text-label text-ink-tertiary hidden xs:block">
                    REAL-TIME TECHNICAL ANALYSIS
                  </p>
                </div>
              </button>
            </div>
            
            {/* Right: Status indicators */}
            <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
              {viewMode === 'explore' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToExplore}
                  className="hidden sm:flex gap-2 text-ink-secondary"
                >
                  <Home className="h-4 w-4" strokeWidth={1.5} />
                  Screens
                </Button>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isConnected ? 'bg-signal-success animate-pulse-dot' : 'bg-signal-error'
                }`} />
                <span className="text-[10px] sm:text-label text-ink-secondary">
                  {isConnected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              {lastUpdate && (
                <span className="text-[10px] sm:text-data font-mono text-ink-tertiary hidden sm:block">
                  {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1">
        {viewMode === 'explore' && (
          <PresetExplorer
            onPresetSelect={handlePresetSelect}
            onCreateCustom={handleCreateCustom}
          />
        )}
        
        {viewMode === 'screener' && (
          <ScreenerView
            activePreset={activePreset}
            onPresetChange={setActivePreset}
          />
        )}
        
        {viewMode === 'custom' && (
          <FilterBuilder />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-grid bg-surface-card">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] sm:text-label text-ink-tertiary">
              DATA PROVIDED BY MASSIVE (POLYGON.IO) API
            </p>
            <span className="text-accent-main font-mono text-[10px]">+</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
