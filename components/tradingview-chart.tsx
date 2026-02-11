'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  UTCTimestamp,
  LineData,
  CandlestickData,
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type RangeKey = '24H' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';
type ChartType = 'area' | 'line' | 'candlestick';

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '24H', label: '24H' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
];

type CandleResponse = {
  s: 'ok' | 'no_data';
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
  // plus our echo fields:
  symbol?: string;
  range?: string;
  resolution?: string;
  error?: string;
  providers?: Record<string, string>;
  meta?: {
    requestId?: string;
    cacheHit?: boolean;
    providerAttempts?: Array<{
      provider: string;
      status: 'ok' | 'error' | 'skipped';
      latencyMs: number;
      error?: string;
    }>;
  };
};

type ChartLoadError = {
  message: string;
  providers?: Record<string, string>;
  requestId?: string;
};

interface TradingViewChartProps {
  symbol?: string;
  isLoading?: boolean; // loading from stock quote/profile (Home)
}

export function TradingViewChart({ symbol, isLoading }: TradingViewChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { theme } = useTheme();

  const [range, setRange] = useState<RangeKey>('3M');
  const [chartType, setChartType] = useState<ChartType>('area');

  const [candleResp, setCandleResp] = useState<CandleResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartProviderErrors, setChartProviderErrors] = useState<Record<string, string>>({});
  const [chartRequestId, setChartRequestId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(400);

  // Fullscreen state tracking
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Update chart height for normal vs fullscreen
  useEffect(() => {
    const compute = () => {
      if (!isFullscreen) return 400;
      return Math.max(420, window.innerHeight - 220);
    };

    const apply = () => setChartHeight(compute());

    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    try {
      if (!wrapperRef.current) return;

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await wrapperRef.current.requestFullscreen();
      }
    } catch {
      // ignore (some browsers block fullscreen if not triggered by user gesture)
    }
  };

  // Fetch candles when symbol or range changes
  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();
    setChartLoading(true);
    setChartError(null);
    setChartProviderErrors({});
    setChartRequestId(null);

    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw {
            message: json?.error ?? 'Candles fetch failed',
            providers: json?.providers,
            requestId: json?.meta?.requestId,
          } satisfies ChartLoadError;
        }
        return json as CandleResponse;
      })
      .then((json) => {
        setChartRequestId(json.meta?.requestId ?? null);

        if (json.s !== 'ok' || !Array.isArray(json.t) || !Array.isArray(json.c)) {
          setCandleResp(json);
          setChartProviderErrors(json.providers ?? {});
          setChartError(json.error ?? 'No chart data available for this range.');
          return;
        }

        setChartProviderErrors({});
        setCandleResp(json);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setCandleResp(null);
          if (err && typeof err === 'object' && 'message' in err) {
            const parsed = err as ChartLoadError;
            setChartProviderErrors(parsed.providers ?? {});
            setChartRequestId(parsed.requestId ?? null);
            setChartError(parsed.message);
          } else if (err instanceof Error) {
            setChartError(err.message);
          } else {
            setChartError('Failed to load chart');
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChartLoading(false);
      });

    return () => controller.abort();
  }, [symbol, range, reloadTick]);

  const lineData = useMemo<LineData[]>(() => {
    if (!candleResp || candleResp.s !== 'ok' || !candleResp.t || !candleResp.c) return [];
    return candleResp.t.map((ts, i) => ({
      time: ts as UTCTimestamp,
      value: candleResp.c![i],
    }));
  }, [candleResp]);

  const candleData = useMemo<CandlestickData[]>(() => {
    if (
      !candleResp ||
      candleResp.s !== 'ok' ||
      !candleResp.t ||
      !candleResp.o ||
      !candleResp.h ||
      !candleResp.l ||
      !candleResp.c
    )
      return [];

    return candleResp.t.map((ts, i) => ({
      time: ts as UTCTimestamp,
      open: candleResp.o![i],
      high: candleResp.h![i],
      low: candleResp.l![i],
      close: candleResp.c![i],
    }));
  }, [candleResp]);

  // Create chart whenever theme/type/data changes (simple + robust)
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!symbol) return;
    if (chartLoading) return;

    const hasData = chartType === 'candlestick' ? candleData.length > 0 : lineData.length > 0;
    if (!hasData) return;

    // Cleanup previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const isDark = theme === 'dark';
    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#9ca3af' : '#6b7280',
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
        horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
      },
      width: container.clientWidth,
      height: chartHeight,
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
      },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        timeVisible: true,
        secondsVisible: range === '24H',
      },
    });

    chartRef.current = chart;

    if (chartType === 'candlestick') {
      const s = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        borderVisible: false,
      });
      s.setData(candleData);
    } else if (chartType === 'line') {
      const s = chart.addLineSeries({
        color: '#6366f1',
        lineWidth: 2,
      });
      s.setData(lineData);
    } else {
      const s = chart.addAreaSeries({
        lineColor: '#6366f1',
        topColor: 'rgba(99, 102, 241, 0.35)',
        bottomColor: 'rgba(99, 102, 241, 0.00)',
        lineWidth: 2,
      });
      s.setData(lineData);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (!chartRef.current || !chartContainerRef.current) return;
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartHeight,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, theme, chartType, lineData, candleData, chartLoading, chartHeight, range]);

  const showSkeleton = isLoading || chartLoading;

  if (!symbol) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Search for a stock to see the chart.</p>
        </CardContent>
      </Card>
    );
  }

  if (showSkeleton) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasAnyData = chartType === 'candlestick' ? candleData.length > 0 : lineData.length > 0;
  const hasProviderErrors = Object.keys(chartProviderErrors).length > 0;

  const guidance = [
    'Verify the symbol and exchange format (examples: AAPL, SAP.DE, 7203.T).',
    'Try a broader range like 1M or 1Y to include more history.',
    'Use Retry after a few seconds when providers are rate-limited.',
  ];

  if (chartError || !hasAnyData) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{symbol} Price Chart</CardTitle>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </Button>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          <div className="max-w-2xl w-full space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-base">Unable to render chart data</p>
              <p className="text-muted-foreground">{chartError ?? 'No data available for this range yet.'}</p>
            </div>

            {hasProviderErrors && (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium mb-2">Provider status</p>
                <ul className="space-y-1 text-muted-foreground">
                  {Object.entries(chartProviderErrors).map(([provider, msg]) => (
                    <li key={provider}>
                      <span className="font-medium text-foreground">{provider}</span>: {msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-md border border-dashed p-3">
              <p className="font-medium mb-2">How to fix quickly</p>
              <ul className="space-y-1 text-muted-foreground">
                {guidance.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setReloadTick((v) => v + 1)}>
                Retry
              </Button>
              <Button type="button" variant="secondary" onClick={() => setRange('1M')}>
                Try 1M
              </Button>
              <Button type="button" variant="secondary" onClick={() => setRange('1Y')}>
                Try 1Y
              </Button>
            </div>

            {chartRequestId && (
              <p className="text-xs text-muted-foreground">Request ID: {chartRequestId}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={wrapperRef} className={cn(isFullscreen && 'bg-background')}>
      <Card className={cn(isFullscreen && 'border-0 rounded-none shadow-none')}>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{symbol} Price Chart</CardTitle>

            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>
          </div>

          {/* Range buttons */}
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((r) => (
              <Button
                key={r.key}
                type="button"
                variant={range === r.key ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>

          {/* Chart type buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={chartType === 'area' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setChartType('area')}
            >
              Area
            </Button>
            <Button
              type="button"
              variant={chartType === 'line' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              Line
            </Button>
            <Button
              type="button"
              variant={chartType === 'candlestick' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setChartType('candlestick')}
            >
              Candlestick
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div
            ref={chartContainerRef}
            className="w-full"
            style={{ height: chartHeight }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
