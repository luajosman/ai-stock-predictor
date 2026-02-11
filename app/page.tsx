'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { StockSearch } from '@/components/stock-search';
import { StockStats } from '@/components/stock-stats';
import { TradingViewWidget } from '@/components/tradingview-widget';
import { AIAnalyst } from '@/components/ai-analyst';
import { WatchlistItem, WatchlistPanel } from '@/components/watchlist-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Sparkles, BarChart3 } from 'lucide-react';

interface StockData {
  quote: any;
  profile: any;
}

const WATCHLIST_STORAGE_KEY = 'stock-predictor.watchlist.v1';

function sanitizeWatchlist(items: unknown): WatchlistItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;

      const symbol = String(row.symbol ?? '').trim().toUpperCase();
      if (!symbol) return null;

      return {
        symbol,
        name: String(row.name ?? symbol).trim() || symbol,
        addedAt: Number(row.addedAt ?? Date.now()),
      } satisfies WatchlistItem;
    })
    .filter((item): item is WatchlistItem => item !== null)
    .slice(0, 50);
}

export default function Home() {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [symbol, setSymbol] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistReady, setWatchlistReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!raw) {
        setWatchlistReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      setWatchlist(sanitizeWatchlist(parsed));
    } catch {
      setWatchlist([]);
    } finally {
      setWatchlistReady(true);
    }
  }, []);

  useEffect(() => {
    if (!watchlistReady) return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist, watchlistReady]);

  const handleSearch = async (searchSymbol: string) => {
    const cleanedSymbol = (searchSymbol || '').toUpperCase().trim();
    if (!cleanedSymbol) return;

    setIsLoading(true);
    setError(null);
    setSymbol(cleanedSymbol);

    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(cleanedSymbol)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch stock data');
      }

      const data = await response.json();
      setStockData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const activeName = stockData?.profile?.name || symbol;

  const isCurrentInWatchlist = useMemo(() => {
    if (!symbol) return false;
    return watchlist.some((item) => item.symbol === symbol);
  }, [watchlist, symbol]);

  const toggleCurrentWatchlist = () => {
    if (!symbol) return;

    if (isCurrentInWatchlist) {
      setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
      return;
    }

    const nextItem: WatchlistItem = {
      symbol,
      name: activeName || symbol,
      addedAt: Date.now(),
    };

    setWatchlist((prev) => {
      const withoutCurrent = prev.filter((item) => item.symbol !== symbol);
      return [nextItem, ...withoutCurrent].slice(0, 50);
    });
  };

  const removeFromWatchlist = (targetSymbol: string) => {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== targetSymbol));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Stock Predictor</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Global Markets</p>
              </div>
            </motion.div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* Search */}
        <section>
          <StockSearch onSearch={handleSearch} isLoading={isLoading} />
        </section>

        <section>
          <WatchlistPanel
            items={watchlist}
            activeSymbol={symbol || undefined}
            activeName={activeName}
            onToggleActive={symbol ? toggleCurrentWatchlist : undefined}
            onSelect={handleSearch}
            onRemove={removeFromWatchlist}
          />
        </section>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive"
          >
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </motion.div>
        )}

        {/* Data */}
        {(isLoading || stockData) && (
          <div className="space-y-6">
            <StockStats
              symbol={symbol}
              name={stockData?.profile?.name || symbol}
              currentPrice={stockData?.quote?.c || 0}
              change={stockData?.quote?.d || 0}
              changePercent={stockData?.quote?.dp || 0}
              high={stockData?.quote?.h || 0}
              low={stockData?.quote?.l || 0}
              open={stockData?.quote?.o || 0}
              previousClose={stockData?.quote?.pc || 0}
              isLoading={isLoading}
            />

            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
                <TabsTrigger value="chart" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Price Chart
                </TabsTrigger>

                <TabsTrigger value="analysis" disabled={isLoading || !stockData} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-6">
                {symbol && <TradingViewWidget symbol={symbol} isLoading={isLoading} />}
              </TabsContent>

              <TabsContent value="analysis" className="mt-6">
                {stockData?.quote && (
                  <AIAnalyst
                    symbol={symbol}
                    currentPrice={stockData.quote.c}
                    change={stockData.quote.d}
                    changePercent={stockData.quote.dp}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Welcome */}
        {!stockData && !isLoading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center py-20 space-y-6"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
              className="inline-block p-6 bg-primary/10 rounded-2xl"
            >
              <TrendingUp className="h-16 w-16 text-primary" />
            </motion.div>

            <h2 className="text-3xl font-bold">Welcome to Stock Predictor</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Search stocks from <strong>global markets</strong> including US, Germany, Switzerland, France, Japan, and Hong Kong. 
              View professional TradingView charts and get AI-powered analysis from Claude.
            </p>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-20 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          <p>
            Powered by{' '}
            <a
              href="https://www.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors font-medium"
            >
              Claude AI
            </a>
            {' • '}
            <a
              href="https://finnhub.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors font-medium"
            >
              Finnhub
            </a>
            {' • '}
            <a
              href="https://tradingview.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors font-medium"
            >
              TradingView
            </a>
          </p>
          <p className="mt-2 text-xs">For educational purposes only. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
