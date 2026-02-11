'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StockSearchProps {
  onSearch: (symbol: string) => void;
  isLoading?: boolean;
}

type Suggestion = {
  symbol: string;
  displaySymbol: string;
  description: string;
  type?: string;
};

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
];

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function StockSearch({ onSearch, isLoading }: StockSearchProps) {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);

  const blurTimeoutRef = useRef<number | null>(null);

  const debounced = useDebouncedValue(symbol.trim(), 250);

  const hasSuggestions = suggestions.length > 0;

  const firstSuggestionSymbol = useMemo(() => {
    if (!hasSuggestions) return null;
    return suggestions[0].symbol?.toUpperCase() ?? null;
  }, [hasSuggestions, suggestions]);

  useEffect(() => {
    if (!debounced) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setIsSuggestLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? 'Search failed');
        return json;
      })
      .then((json) => {
        const list = (json?.result ?? []) as Suggestion[];
        setSuggestions(list);
        setOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
          setActiveIndex(-1);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSuggestLoading(false);
      });

    return () => controller.abort();
  }, [debounced]);

  const selectSymbol = (sym: string) => {
    const cleaned = sym.toUpperCase().trim();
    if (!cleaned) return;

    setSymbol(cleaned);
    setOpen(false);
    setActiveIndex(-1);
    onSearch(cleaned);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Wenn Vorschläge da sind, nimm “smart” den ersten / aktiven Vorschlag
    if (open && hasSuggestions) {
      const picked =
        activeIndex >= 0 ? suggestions[activeIndex]?.symbol : firstSuggestionSymbol;

      if (picked) return selectSymbol(picked);
    }

    // Fallback: user entered exact symbol
    if (symbol.trim()) selectSymbol(symbol);
  };

  const handleQuickSelect = (stock: string) => {
    setSymbol(stock);
    onSearch(stock);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hasSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter') {
      // Enter handled by form submit, but prevent double
      // (optional) keep as is
    }
  };

  const handleBlur = () => {
    // Delay close so click on suggestion works
    blurTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 150);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (suggestions.length > 0) setOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            type="text"
            placeholder="Search by symbol or company name (e.g., AAPL, Apple)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className="pl-10 h-12 text-base"
            disabled={isLoading}
            autoComplete="off"
          />

          {/* Suggestions dropdown */}
          {open && (isSuggestLoading || hasSuggestions) && (
            <div className="absolute top-full mt-2 w-full z-50 rounded-lg border bg-background shadow-lg overflow-hidden">
              {isSuggestLoading && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Searching…
                </div>
              )}

              {!isSuggestLoading &&
                suggestions.map((s, idx) => {
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={`${s.symbol}-${idx}`}
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()} // prevents blur before click
                      onClick={() => selectSymbol(s.symbol)}
                      className={[
                        'w-full text-left px-4 py-3 flex items-center justify-between gap-3',
                        active ? 'bg-muted' : 'hover:bg-muted/60',
                      ].join(' ')}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">{s.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.description}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {s.type ?? ''}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <Button type="submit" disabled={isLoading || !symbol.trim()} size="lg">
          {isLoading ? 'Loading...' : 'Search'}
        </Button>
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Popular:</span>
        {POPULAR_STOCKS.map((stock, index) => (
          <motion.div
            key={stock.symbol}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1"
              onClick={() => handleQuickSelect(stock.symbol)}
            >
              {stock.symbol}
            </Badge>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
