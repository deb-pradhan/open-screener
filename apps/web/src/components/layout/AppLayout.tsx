import { ReactNode, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ChevronRight, Search, X } from 'lucide-react';
import TickerSearch from '@/components/search/TickerSearch';

interface AppLayoutProps {
  children: ReactNode;
}

// Map preset IDs to readable names
const presetNames: Record<string, string> = {
  highVolume: 'High Volume Movers',
  momentum: 'Momentum Breakouts',
  oversold: 'Oversold Bounces',
  gapUp: 'Gap Up Stocks',
  custom: 'Custom Screen',
};

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  
  // Get active preset from URL if on screener page
  const presetMatch = location.pathname.match(/\/screener\/(.+)/);
  const activePreset = presetMatch ? presetMatch[1] : null;
  
  const { isConnected, lastUpdate } = useWebSocket(activePreset || 'highVolume');

  // Get current page name for breadcrumb
  const currentPageName = activePreset 
    ? presetNames[activePreset] || activePreset 
    : null;

  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col">
      {/* Header */}
      <header className="bg-surface-card border-b border-border-grid">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Logo + Breadcrumb */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* Logo - Always first, always links home */}
              <Link 
                to="/"
                className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <img 
                  src="/logo.png" 
                  alt="Open Screener" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
                <div className="hidden sm:block">
                  <h1 className="text-base sm:text-h1 text-ink-primary leading-tight">Open Screener</h1>
                  <p className="text-[9px] sm:text-label text-ink-tertiary">
                    REAL-TIME TECHNICAL ANALYSIS
                  </p>
                </div>
              </Link>
              
              {/* Breadcrumb - Shows current location */}
              {!isHome && currentPageName && (
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <ChevronRight className="h-4 w-4 text-ink-tertiary flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm text-ink-secondary truncate">
                    {currentPageName}
                  </span>
                </div>
              )}
            </div>
            
            {/* Center: Search */}
            <div className="flex-1 max-w-md mx-4 hidden sm:block">
              <TickerSearch placeholder="Search ticker or company..." />
            </div>
            
            {/* Right: Status indicators + Mobile Search Toggle */}
            <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
              {/* Mobile search toggle */}
              <button
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className="sm:hidden p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                aria-label="Toggle search"
              >
                {mobileSearchOpen ? (
                  <X className="h-5 w-5 text-ink-secondary" />
                ) : (
                  <Search className="h-5 w-5 text-ink-secondary" />
                )}
              </button>
              
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
          
          {/* Mobile Search Bar */}
          {mobileSearchOpen && (
            <div className="sm:hidden mt-3 pb-1">
              <TickerSearch 
                placeholder="Search ticker or company..." 
                onSelect={() => setMobileSearchOpen(false)}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-grid bg-surface-card">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-[9px] sm:text-label text-ink-tertiary text-center sm:text-left">
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
        </div>
      </footer>
    </div>
  );
}
