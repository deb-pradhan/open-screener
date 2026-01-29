import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { useTickerSearch, SearchResult } from '@/hooks/useTickerSearch';
import { cn } from '@/lib/utils';

interface TickerSearchProps {
  className?: string;
  placeholder?: string;
  onSelect?: () => void;
}

export default function TickerSearch({ 
  className,
  placeholder = "Search stocks...",
  onSelect 
}: TickerSearchProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { query, setQuery, results, isLoading, clear, hasResults } = useTickerSearch();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(`/ticker/${result.symbol}`);
    clear();
    setIsOpen(false);
    inputRef.current?.blur();
    onSelect?.();
  }, [navigate, clear, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || !hasResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, hasResults, results, selectedIndex, handleSelect]);

  const showDropdown = isOpen && (hasResults || isLoading || query.length >= 1);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-tertiary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 pl-9 pr-8 rounded-pill border border-border-element bg-surface-card",
            "text-sm text-ink-primary placeholder:text-ink-tertiary",
            "focus:outline-none focus:border-accent-main focus:ring-1 focus:ring-accent-main",
            "transition-colors"
          )}
        />
        {query && (
          <button
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-subtle rounded-full transition-colors"
          >
            <X className="h-3.5 w-3.5 text-ink-tertiary" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-border-element rounded-lg shadow-lg overflow-hidden z-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-ink-tertiary">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : hasResults ? (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((result, index) => (
                <li key={result.symbol}>
                  <button
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                      selectedIndex === index 
                        ? "bg-surface-subtle" 
                        : "hover:bg-surface-subtle"
                    )}
                  >
                    <div className="flex-shrink-0 w-16 text-left">
                      <span className="text-sm font-medium text-accent-main">
                        {result.symbol}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-primary truncate">
                        {result.name || result.symbol}
                      </p>
                    </div>
                    {result.price !== null && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-mono text-ink-primary">
                          ${result.price.toFixed(2)}
                        </p>
                        {result.changePercent !== null && (
                          <p className={cn(
                            "text-xs font-mono",
                            result.changePercent >= 0 ? "text-signal-success" : "text-signal-error"
                          )}>
                            {result.changePercent >= 0 ? '+' : ''}{result.changePercent.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : query.length >= 1 ? (
            <div className="py-4 text-center text-ink-tertiary text-sm">
              No results found for "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
