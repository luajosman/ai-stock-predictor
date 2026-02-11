import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- minimal in-memory cache ---
type CacheEntry = { expires: number; payload: any };
const g = globalThis as any;
const cache: Map<string, CacheEntry> = g.__tvHistoryCache ?? new Map();
g.__tvHistoryCache = cache;

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

function mapResolutionToInterval(resolution: string) {
  const r = resolution.toUpperCase();

  // Minuten
  if (r === "1") return "1min";
  if (r === "5") return "5min";
  if (r === "15") return "15min";
  if (r === "30") return "30min";
  if (r === "60") return "1h";
  if (r === "120") return "2h";
  if (r === "240") return "4h";

  // Daily/Weekly/Monthly
  if (r === "D" || r === "1D") return "1day";
  if (r === "W" || r === "1W") return "1week";
  if (r === "M" || r === "1M") return "1month";

  // Fallback
  return "1day";
}

function ttlForInterval(interval: string) {
  // Intraday: kurz, Daily+: länger
  if (interval.includes("min") || interval.includes("h")) return 15; // 15s
  return 120; // 2min
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();
  const resolution = (searchParams.get("resolution") || "D").trim();
  const from = Number(searchParams.get("from") || "0");
  const to = Number(searchParams.get("to") || "0");

  if (!symbol) {
    return NextResponse.json({ s: "error", errmsg: "Missing symbol" }, { status: 400 });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ s: "error", errmsg: "TWELVEDATA_API_KEY missing" }, { status: 500 });
  }

  const interval = mapResolutionToInterval(resolution);
  const cacheKey = `${symbol}|${resolution}|${from}|${to}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("apikey", apiKey);

  // Grenzen setzen (TradingView liefert unix seconds)
  url.searchParams.set("start_date", toUTCDateTime(from));
  url.searchParams.set("end_date", toUTCDateTime(to));

  // Für TV brauchen wir OHLCV; Twelve Data liefert values[] mit datetime/open/high/low/close/volume
  const r = await fetch(url.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => null);

  // Twelve Data Fehler (z.B. rate limit) sauber als UDF error zurückgeben
  if (!r.ok || !j) {
    return NextResponse.json({ s: "error", errmsg: "Twelve Data history failed" }, { status: 502 });
  }
  if (j?.status === "error") {
    return NextResponse.json({ s: "error", errmsg: j?.message || "Twelve Data error" }, { status: 502 });
  }

  const values: any[] = Array.isArray(j?.values) ? j.values : [];
  if (!values.length) {
    return NextResponse.json({ s: "no_data" });
  }

  // Twelve Data liefert meist DESC (neueste zuerst) -> wir sortieren ASC
  const rows = values
    .map((v) => {
      const dt = String(v.datetime || "");
      // dt: "YYYY-MM-DD" oder "YYYY-MM-DD HH:mm:ss"
      const iso = dt.includes(" ") ? dt.replace(" ", "T") + "Z" : dt + "T00:00:00Z";
      const t = Math.floor(new Date(iso).getTime() / 1000);

      return {
        t,
        o: Number(v.open),
        h: Number(v.high),
        l: Number(v.low),
        c: Number(v.close),
        v: Number(v.volume ?? 0),
      };
    })
    .filter((x) => Number.isFinite(x.t) && x.t >= from && x.t <= to)
    .sort((a, b) => a.t - b.t);

  if (!rows.length) {
    return NextResponse.json({ s: "no_data" });
  }

  const payload = {
    s: "ok",
    t: rows.map((x) => x.t),
    o: rows.map((x) => x.o),
    h: rows.map((x) => x.h),
    l: rows.map((x) => x.l),
    c: rows.map((x) => x.c),
    v: rows.map((x) => x.v),
  };

  cache.set(cacheKey, { expires: Date.now() + ttlForInterval(interval) * 1000, payload });
  return NextResponse.json(payload);
}
