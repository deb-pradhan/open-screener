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
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {viewMode !== 'explore' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToExplore}
                  className="mr-2 gap-2"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                  Back
                </Button>
              )}
              <button 
                onClick={handleBackToExplore}
                className="flex items-center gap-4 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 bg-accent-main flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-ink-on-accent" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-h1 text-ink-primary">Stock Screener</h1>
                  <p className="text-label text-ink-tertiary">
                    REAL-TIME TECHNICAL ANALYSIS
                  </p>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-6">
              {viewMode === 'explore' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToExplore}
                  className="gap-2 text-ink-secondary"
                >
                  <Home className="h-4 w-4" strokeWidth={1.5} />
                  Screens
                </Button>
              )}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-signal-success animate-pulse-dot' : 'bg-signal-error'
                }`} />
                <span className="text-label text-ink-secondary">
                  {isConnected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              {lastUpdate && (
                <span className="text-data font-mono text-ink-tertiary">
                  {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 flex-1">
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
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-label text-ink-tertiary">
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
