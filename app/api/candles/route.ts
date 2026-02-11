import { NextRequest, NextResponse } from "next/server";
import {
  ProviderAttempt,
  beginProviderAttempt,
  createRequestId,
  recordSkippedProviderAttempt,
} from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_ID = "/api/candles";

type RangeKey = "24H" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

type CandlePayload = {
  s: "ok";
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  provider: "finnhub" | "twelvedata" | "alphavantage";
  symbol: string;
  range: RangeKey;
  resolution: string;
};

type CacheEntry = { expires: number; payload: CandlePayload };
type CandleRow = { t: number; o: number; h: number; l: number; c: number; v: number };

const g = globalThis as typeof globalThis & { __candlesCache?: Map<string, CacheEntry> };
const cache = g.__candlesCache ?? new Map<string, CacheEntry>();
g.__candlesCache = cache;

const RANGE_ALIASES: Record<string, RangeKey> = {
  "24H": "24H",
  "1D": "24H",
  "3H": "24H",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  "1Y": "1Y",
  "YTD": "1Y",
  "5Y": "5Y",
};

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function parseRange(raw: string | null): RangeKey {
  const normalized = (raw ?? "3M").trim().toUpperCase();
  return RANGE_ALIASES[normalized] ?? "3M";
}

function rangeToFrom(range: RangeKey, to: number) {
  const day = 24 * 60 * 60;

  switch (range) {
    case "24H":
      return to - day;
    case "1W":
      return to - 7 * day;
    case "1M":
      return to - 30 * day;
    case "3M":
      return to - 90 * day;
    case "6M":
      return to - 180 * day;
    case "1Y":
      return to - 365 * day;
    case "5Y":
      return to - 5 * 365 * day;
    default:
      return to - 90 * day;
  }
}

function finnhubResolution(range: RangeKey) {
  switch (range) {
    case "24H":
      return "5";
    case "1W":
      return "30";
    case "1M":
      return "60";
    case "3M":
    case "6M":
    case "1Y":
      return "D";
    case "5Y":
      return "W";
    default:
      return "D";
  }
}

function twelveDataInterval(range: RangeKey) {
  switch (range) {
    case "24H":
      return "5min";
    case "1W":
      return "30min";
    case "1M":
      return "1h";
    case "3M":
    case "6M":
    case "1Y":
      return "1day";
    case "5Y":
      return "1week";
    default:
      return "1day";
  }
}

function toUTCDateTime(sec: number) {
  const d = new Date(sec * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function ttlSeconds(range: RangeKey) {
  if (range === "24H") return 20;
  if (range === "1W") return 45;
  if (range === "1M") return 60;
  return 180;
}

function toPayload(
  rows: CandleRow[],
  provider: CandlePayload["provider"],
  symbol: string,
  range: RangeKey,
  resolution: string
): CandlePayload {
  return {
    s: "ok",
    t: rows.map((r) => r.t),
    o: rows.map((r) => r.o),
    h: rows.map((r) => r.h),
    l: rows.map((r) => r.l),
    c: rows.map((r) => r.c),
    v: rows.map((r) => r.v),
    provider,
    symbol,
    range,
    resolution,
  };
}

function normalizeRows(rows: CandleRow[], from: number, to: number) {
  return rows
    .filter(
      (r) =>
        Number.isFinite(r.t) &&
        Number.isFinite(r.o) &&
        Number.isFinite(r.h) &&
        Number.isFinite(r.l) &&
        Number.isFinite(r.c) &&
        Number.isFinite(r.v) &&
        r.t >= from &&
        r.t <= to
    )
    .sort((a, b) => a.t - b.t);
}

function parseTimestamp(value: string) {
  const iso = value.includes(" ") ? `${value.replace(" ", "T")}Z` : `${value}T00:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function parseFinnhubRows(data: unknown): CandleRow[] {
  if (!data || typeof data !== "object") return [];

  const raw = data as {
    s?: string;
    t?: unknown[];
    o?: unknown[];
    h?: unknown[];
    l?: unknown[];
    c?: unknown[];
    v?: unknown[];
  };

  if (raw.s !== "ok") return [];
  if (!Array.isArray(raw.t) || !Array.isArray(raw.o) || !Array.isArray(raw.h) || !Array.isArray(raw.l) || !Array.isArray(raw.c)) {
    return [];
  }

  const len = Math.min(raw.t.length, raw.o.length, raw.h.length, raw.l.length, raw.c.length, Array.isArray(raw.v) ? raw.v.length : Number.MAX_SAFE_INTEGER);
  const rows: CandleRow[] = [];

  for (let i = 0; i < len; i += 1) {
    rows.push({
      t: Number(raw.t[i]),
      o: Number(raw.o[i]),
      h: Number(raw.h[i]),
      l: Number(raw.l[i]),
      c: Number(raw.c[i]),
      v: Array.isArray(raw.v) ? Number(raw.v[i]) : 0,
    });
  }

  return rows;
}

async function fetchFinnhubCandles(
  symbol: string,
  range: RangeKey,
  from: number,
  to: number,
  apiKey: string
) {
  const resolution = finnhubResolution(range);
  const url =
    `https://finnhub.io/api/v1/stock/candle` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&resolution=${encodeURIComponent(resolution)}` +
    `&from=${from}` +
    `&to=${to}` +
    `&token=${apiKey}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json && typeof json === "object" && "error" in json ? String((json as { error?: string }).error ?? "") : "";
    throw new Error(err || `Finnhub candles failed (${res.status})`);
  }

  const rows = normalizeRows(parseFinnhubRows(json), from, to);
  if (!rows.length) throw new Error("Finnhub returned no data for selected range");

  return toPayload(rows, "finnhub", symbol, range, resolution);
}

function parseTwelveDataRows(data: unknown): CandleRow[] {
  if (!data || typeof data !== "object") return [];

  const raw = data as {
    status?: string;
    values?: Array<{
      datetime?: string;
      open?: string | number;
      high?: string | number;
      low?: string | number;
      close?: string | number;
      volume?: string | number;
    }>;
  };

  if (raw.status === "error") return [];
  if (!Array.isArray(raw.values)) return [];

  return raw.values.map((v) => ({
    t: parseTimestamp(String(v.datetime ?? "")),
    o: Number(v.open),
    h: Number(v.high),
    l: Number(v.low),
    c: Number(v.close),
    v: Number(v.volume ?? 0),
  }));
}

async function fetchTwelveDataCandles(
  symbol: string,
  range: RangeKey,
  from: number,
  to: number,
  apiKey: string
) {
  const interval = twelveDataInterval(range);
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("start_date", toUTCDateTime(from));
  url.searchParams.set("end_date", toUTCDateTime(to));
  url.searchParams.set("outputsize", "5000");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json) throw new Error(`Twelve Data candles failed (${res.status})`);
  if (typeof json === "object" && json && "status" in json && (json as { status?: string }).status === "error") {
    const message = "message" in json ? String((json as { message?: string }).message ?? "Twelve Data error") : "Twelve Data error";
    throw new Error(message);
  }

  const rows = normalizeRows(parseTwelveDataRows(json), from, to);
  if (!rows.length) throw new Error("Twelve Data returned no data for selected range");

  return toPayload(rows, "twelvedata", symbol, range, interval);
}

function alphaConfig(range: RangeKey) {
  switch (range) {
    case "24H":
      return { fn: "TIME_SERIES_INTRADAY", interval: "5min", outputsize: "compact" as const };
    case "1W":
      return { fn: "TIME_SERIES_INTRADAY", interval: "30min", outputsize: "compact" as const };
    case "1M":
      return { fn: "TIME_SERIES_INTRADAY", interval: "60min", outputsize: "full" as const };
    case "3M":
      return { fn: "TIME_SERIES_DAILY_ADJUSTED", interval: null, outputsize: "compact" as const };
    case "6M":
    case "1Y":
      return { fn: "TIME_SERIES_DAILY_ADJUSTED", interval: null, outputsize: "full" as const };
    case "5Y":
      return { fn: "TIME_SERIES_WEEKLY_ADJUSTED", interval: null, outputsize: "full" as const };
    default:
      return { fn: "TIME_SERIES_DAILY_ADJUSTED", interval: null, outputsize: "compact" as const };
  }
}

function parseAlphaRows(data: unknown, range: RangeKey): CandleRow[] {
  if (!data || typeof data !== "object") throw new Error("Alpha Vantage: empty response");
  const raw = data as Record<string, unknown>;

  if (typeof raw.Note === "string" && raw.Note) throw new Error(raw.Note);
  if (typeof raw.Error_Message === "string" && raw.Error_Message) throw new Error(raw.Error_Message);

  const cfg = alphaConfig(range);
  const seriesKey =
    cfg.fn === "TIME_SERIES_INTRADAY"
      ? `Time Series (${cfg.interval})`
      : cfg.fn === "TIME_SERIES_WEEKLY_ADJUSTED"
      ? "Weekly Adjusted Time Series"
      : "Time Series (Daily)";

  const series = raw[seriesKey];
  if (!series || typeof series !== "object") throw new Error("Alpha Vantage: no time series data");

  return Object.entries(series as Record<string, Record<string, string>>).map(([ts, row]) => ({
    t: parseTimestamp(ts),
    o: Number(row["1. open"]),
    h: Number(row["2. high"]),
    l: Number(row["3. low"]),
    c: Number(row["4. close"]),
    v: Number(row["6. volume"] ?? row["5. volume"] ?? 0),
  }));
}

async function fetchAlphaVantageCandles(
  symbol: string,
  range: RangeKey,
  from: number,
  to: number,
  apiKey: string
) {
  const cfg = alphaConfig(range);
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", cfg.fn);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  if (cfg.interval) url.searchParams.set("interval", cfg.interval);
  url.searchParams.set("outputsize", cfg.outputsize);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new Error(`Alpha Vantage candles failed (${res.status})`);

  const rows = normalizeRows(parseAlphaRows(json, range), from, to);
  if (!rows.length) throw new Error("Alpha Vantage returned no data for selected range");

  const resolution = cfg.fn === "TIME_SERIES_WEEKLY_ADJUSTED" ? "W" : cfg.fn === "TIME_SERIES_INTRADAY" ? String(cfg.interval) : "D";
  return toPayload(rows, "alphavantage", symbol, range, resolution);
}

export async function GET(req: NextRequest) {
  const requestId = createRequestId("candles");
  const providerAttempts: ProviderAttempt[] = [];

  const searchParams = new URL(req.url).searchParams;
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();
  const range = parseRange(searchParams.get("range"));

  if (!symbol) {
    return NextResponse.json(
      {
        error: "Missing symbol",
        meta: {
          requestId,
          providerAttempts,
        },
      },
      { status: 400 }
    );
  }

  const cacheKey = `${symbol}|${range}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({
      ...cached.payload,
      meta: {
        requestId,
        providerAttempts,
        cacheHit: true,
      },
    });
  }

  const to = nowSec();
  const from = rangeToFrom(range, to);
  const providerErrors: Record<string, string> = {};

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    const completeAttempt = beginProviderAttempt({
      requestId,
      route: ROUTE_ID,
      provider: "finnhub",
    });

    try {
      const payload = await fetchFinnhubCandles(symbol, range, from, to, finnhubKey);
      cache.set(cacheKey, { expires: Date.now() + ttlSeconds(range) * 1000, payload });
      providerAttempts.push(completeAttempt("ok"));
      return NextResponse.json({
        ...payload,
        meta: {
          requestId,
          providerAttempts,
          cacheHit: false,
        },
      });
    } catch (error) {
      providerErrors.finnhub = error instanceof Error ? error.message : "Finnhub failed";
      providerAttempts.push(completeAttempt("error", error));
    }
  } else {
    const reason = "FINNHUB_API_KEY missing";
    providerErrors.finnhub = reason;
    providerAttempts.push(
      recordSkippedProviderAttempt({
        requestId,
        route: ROUTE_ID,
        provider: "finnhub",
        reason,
      })
    );
  }

  const twelveDataKey = process.env.TWELVEDATA_API_KEY;
  if (twelveDataKey) {
    const completeAttempt = beginProviderAttempt({
      requestId,
      route: ROUTE_ID,
      provider: "twelvedata",
    });

    try {
      const payload = await fetchTwelveDataCandles(symbol, range, from, to, twelveDataKey);
      cache.set(cacheKey, { expires: Date.now() + ttlSeconds(range) * 1000, payload });
      providerAttempts.push(completeAttempt("ok"));
      return NextResponse.json({
        ...payload,
        meta: {
          requestId,
          providerAttempts,
          cacheHit: false,
        },
      });
    } catch (error) {
      providerErrors.twelvedata = error instanceof Error ? error.message : "Twelve Data failed";
      providerAttempts.push(completeAttempt("error", error));
    }
  } else {
    const reason = "TWELVEDATA_API_KEY missing";
    providerErrors.twelvedata = reason;
    providerAttempts.push(
      recordSkippedProviderAttempt({
        requestId,
        route: ROUTE_ID,
        provider: "twelvedata",
        reason,
      })
    );
  }

  const alphaKey = process.env.ALPHAVANTAGE_API_KEY;
  if (alphaKey) {
    const completeAttempt = beginProviderAttempt({
      requestId,
      route: ROUTE_ID,
      provider: "alphavantage",
    });

    try {
      const payload = await fetchAlphaVantageCandles(symbol, range, from, to, alphaKey);
      cache.set(cacheKey, { expires: Date.now() + ttlSeconds(range) * 1000, payload });
      providerAttempts.push(completeAttempt("ok"));
      return NextResponse.json({
        ...payload,
        meta: {
          requestId,
          providerAttempts,
          cacheHit: false,
        },
      });
    } catch (error) {
      providerErrors.alphavantage = error instanceof Error ? error.message : "Alpha Vantage failed";
      providerAttempts.push(completeAttempt("error", error));
    }
  } else {
    const reason = "ALPHAVANTAGE_API_KEY missing";
    providerErrors.alphavantage = reason;
    providerAttempts.push(
      recordSkippedProviderAttempt({
        requestId,
        route: ROUTE_ID,
        provider: "alphavantage",
        reason,
      })
    );
  }

  return NextResponse.json(
    {
      error: "Unable to fetch candle data from configured providers",
      providers: providerErrors,
      symbol,
      range,
      meta: {
        requestId,
        providerAttempts,
        cacheHit: false,
      },
    },
    { status: 502 }
  );
}
