"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RangeKey = "24H" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";
type ChartTypeKey = "candles" | "line" | "area";

declare global {
  interface Window {
    TradingView?: any;
    Datafeeds?: any;
    UDFCompatibleDatafeed?: any; // fallback (je nach build)
  }
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function rangeToVisible(range: RangeKey) {
  const to = nowSec();
  const day = 24 * 60 * 60;

  switch (range) {
    case "24H":
      return { from: to - 1 * day, to, resolution: "5" };
    case "1W":
      return { from: to - 7 * day, to, resolution: "30" };
    case "1M":
      return { from: to - 30 * day, to, resolution: "60" };
    case "3M":
      return { from: to - 90 * day, to, resolution: "D" };
    case "6M":
      return { from: to - 180 * day, to, resolution: "D" };
    case "1Y":
      return { from: to - 365 * day, to, resolution: "D" };
    case "5Y":
      return { from: to - 5 * 365 * day, to, resolution: "W" };
    default:
      return { from: to - 90 * day, to, resolution: "D" };
  }
}

function getUdfCtor() {
  // Standard: window.Datafeeds.UDFCompatibleDatafeed
  if (window.Datafeeds?.UDFCompatibleDatafeed) return window.Datafeeds.UDFCompatibleDatafeed;

  // Manche Builds exportieren direkt:
  if (window.UDFCompatibleDatafeed) return window.UDFCompatibleDatafeed;

  return null;
}

async function waitForGlobals(timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.TradingView?.widget && getUdfCtor()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

export function TradingViewAdvancedChart({ symbol }: { symbol: string }) {
  const { theme } = useTheme();
  const containerId = useMemo(() => `tv_chart_${Math.random().toString(36).slice(2)}`, []);
  const widgetRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [range, setRange] = useState<RangeKey>("3M");
  const [chartType, setChartType] = useState<ChartTypeKey>("candles");

  const [libLoaded, setLibLoaded] = useState(false);
  const [udfLoaded, setUdfLoaded] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const ready = libLoaded && udfLoaded;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setInitError(null);
      if (!symbol) return;
      if (!ready) return;

      const ok = await waitForGlobals();
      if (!ok) {
        if (!cancelled) {
          setInitError(
            "TradingView oder UDF-Adapter wurde nicht geladen. Prüfe /datafeeds/udf/dist/bundle.js und die Konsole."
          );
        }
        return;
      }

      // destroy existing
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch {}
        widgetRef.current = null;
      }

      const tvTheme = theme === "dark" ? "Dark" : "Light";
      const UdfCtor = getUdfCtor();
      if (!UdfCtor) {
        setInitError("UDFCompatibleDatafeed nicht gefunden (window.Datafeeds ist undefined).");
        return;
      }

      const datafeed = new UdfCtor("/api/tv");

      const widget = new window.TradingView.widget({
        symbol,
        interval: "D",
        container_id: containerId,
        datafeed,
        library_path: "/charting_library/",
        locale: "de",
        theme: tvTheme,
        autosize: true,
        disabled_features: ["use_localstorage_for_settings"],
        enabled_features: [],
      });

      widgetRef.current = widget;

      widget.onChartReady(() => {
        const chart = widget.activeChart();
        const { from, to, resolution } = rangeToVisible(range);

        chart.setResolution(resolution, () => {
          chart.setVisibleRange({ from, to });
        });

        // Chart type setzen (robust)
        const TV = window.TradingView;
        const enumCandles = TV?.ChartType?.CANDLES ?? TV?.ChartType?.Candles ?? 1;
        const enumLine = TV?.ChartType?.LINE ?? TV?.ChartType?.Line ?? 3;
        const enumArea = TV?.ChartType?.AREA ?? TV?.ChartType?.Area ?? 9;

        if (chartType === "candles") chart.setChartType(enumCandles);
        if (chartType === "line") chart.setChartType(enumLine);
        if (chartType === "area") chart.setChartType(enumArea);
      });
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [symbol, ready, theme, containerId, range, chartType]);

  const handleRangeClick = (r: RangeKey) => setRange(r);
  const handleTypeClick = (t: ChartTypeKey) => setChartType(t);

  const toggleFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{symbol} Chart</CardTitle>
        <Button variant="outline" size="sm" onClick={toggleFullscreen}>
          Fullscreen
        </Button>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {(["24H","1W","1M","3M","6M","1Y","5Y"] as RangeKey[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "secondary"}
                onClick={() => handleRangeClick(r)}
              >
                {r}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["candles","line","area"] as ChartTypeKey[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={chartType === t ? "default" : "secondary"}
                onClick={() => handleTypeClick(t)}
              >
                {t === "candles" ? "Candlestick" : t === "line" ? "Line" : "Area"}
              </Button>
            ))}
          </div>
        </div>

        {/* TradingView Library */}
        <Script
          src="/charting_library/charting_library.standalone.js"
          strategy="afterInteractive"
          onLoad={() => setLibLoaded(true)}
          onError={() => {
            setLibLoaded(false);
            setInitError("TradingView Library konnte nicht geladen werden (Pfad prüfen).");
          }}
        />

        {/* UDF Adapter */}
        <Script
          src="/datafeeds/udf/dist/bundle.js"
          strategy="afterInteractive"
          onLoad={() => {
            // Setze udfLoaded nur, wenn der Global wirklich existiert
            if (getUdfCtor()) setUdfLoaded(true);
            else setInitError("UDF bundle geladen, aber window.Datafeeds ist nicht gesetzt (falscher bundle?).");
          }}
          onError={() => {
            setUdfLoaded(false);
            setInitError("UDF bundle konnte nicht geladen werden (Pfad prüfen).");
          }}
        />

        <div ref={wrapperRef} className="w-full">
          <div id={containerId} className="w-full" style={{ height: 520 }} />
        </div>

        {!ready && (
          <p className="text-sm text-muted-foreground mt-3">
            Lade TradingView Charting Library…
          </p>
        )}

        {initError && (
          <p className="text-sm text-destructive mt-3">
            {initError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
