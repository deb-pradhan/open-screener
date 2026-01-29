import { useState } from 'react';
import { ScreenerView } from '@/components/screener/ScreenerView';
import { FilterBuilder } from '@/components/screener/FilterBuilder';
import { PresetExplorer } from '@/components/screener/PresetExplorer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ChevronRight } from 'lucide-react';

type ViewMode = 'explore' | 'screener' | 'custom';

// Map preset IDs to readable names
const presetNames: Record<string, string> = {
  highVolume: 'High Volume Movers',
  momentum: 'Momentum Breakouts',
  oversold: 'Oversold Bounces',
  gapUp: 'Gap Up Stocks',
};

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

  // Get current page name for breadcrumb
  const getCurrentPageName = () => {
    if (viewMode === 'screener') return presetNames[activePreset] || activePreset;
    if (viewMode === 'custom') return 'Custom Screen';
    return null;
  };

  const currentPageName = getCurrentPageName();

  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col">
      {/* Header */}
      <header className="bg-surface-card border-b border-border-grid">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Logo + Breadcrumb */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* Logo - Always first, always links home */}
              <button 
                onClick={handleBackToExplore}
                className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <img 
                  src="/logo.png" 
                  alt="Open Screener" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
                <div className="hidden sm:block">
                  <h1 className="text-base sm:text-h1 text-ink-primary leading-tight text-left">Open Screener</h1>
                  <p className="text-[9px] sm:text-label text-ink-tertiary text-left">
                    REAL-TIME TECHNICAL ANALYSIS
                  </p>
                </div>
              </button>
              
              {/* Breadcrumb - Shows current location */}
              {viewMode !== 'explore' && currentPageName && (
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <ChevronRight className="h-4 w-4 text-ink-tertiary flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm text-ink-secondary truncate">
                    {currentPageName}
                  </span>
                </div>
              )}
            </div>
            
            {/* Right: Status indicators */}
            <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
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
              MADE BY{' '}
              <a 
                href="https://x.com/WhatIsDeb" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-accent-main hover:underline"
              >
                DEB
              </a>
              {' '}FROM{' '}
              <a 
                href="https://x.com/jlabsdigital" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-accent-main hover:underline"
              >
                JLABS DIGITAL
              </a>
            </p>
            <span className="text-accent-main font-mono text-[10px]">+</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
