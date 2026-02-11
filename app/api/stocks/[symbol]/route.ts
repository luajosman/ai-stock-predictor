import { NextRequest, NextResponse } from "next/server";
import {
  ProviderAttempt,
  beginProviderAttempt,
  createRequestId,
  recordSkippedProviderAttempt,
} from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_ID = "/api/stocks/[symbol]";

type Quote = {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
};

type StockPayload = {
  quote: Quote;
  profile: Record<string, unknown> | null;
  provider: "finnhub" | "twelvedata";
};

function toNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function normalizeFinnhubQuote(raw: Record<string, unknown>): Quote {
  return {
    c: toNum(raw.c),
    d: toNum(raw.d),
    dp: toNum(raw.dp),
    h: toNum(raw.h),
    l: toNum(raw.l),
    o: toNum(raw.o),
    pc: toNum(raw.pc),
    t: toNum(raw.t, nowSec()),
  };
}

function normalizeTwelveDataQuote(raw: Record<string, unknown>): Quote {
  const percentRaw = String(raw.percent_change ?? "").replace("%", "").trim();
  return {
    c: toNum(raw.close),
    d: toNum(raw.change),
    dp: toNum(percentRaw),
    h: toNum(raw.high),
    l: toNum(raw.low),
    o: toNum(raw.open),
    pc: toNum(raw.previous_close),
    t: toNum(raw.timestamp, nowSec()),
  };
}

function hasQuoteData(quote: Quote) {
  return Number.isFinite(quote.c) && quote.c > 0;
}

async function fetchFromFinnhub(symbol: string, apiKey: string): Promise<StockPayload> {
  const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  const quoteRes = await fetch(quoteUrl, { cache: "no-store" });
  const quoteJson = await quoteRes.json().catch(() => null);

  if (!quoteRes.ok || !quoteJson || typeof quoteJson !== "object") {
    throw new Error(`Finnhub quote failed (${quoteRes.status})`);
  }

  if ("error" in quoteJson && quoteJson.error) {
    throw new Error(String(quoteJson.error));
  }

  const quote = normalizeFinnhubQuote(quoteJson as Record<string, unknown>);
  if (!hasQuoteData(quote)) {
    throw new Error("Finnhub returned no quote data");
  }

  const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  const profileRes = await fetch(profileUrl, { cache: "no-store" });
  const profileJson = await profileRes.json().catch(() => null);

  const profile =
    profileJson && typeof profileJson === "object" ? (profileJson as Record<string, unknown>) : null;

  return { quote, profile, provider: "finnhub" };
}

async function fetchFromTwelveData(symbol: string, apiKey: string): Promise<StockPayload> {
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json || typeof json !== "object") {
    throw new Error(`Twelve Data quote failed (${res.status})`);
  }

  const raw = json as Record<string, unknown>;
  if (raw.status === "error") {
    throw new Error(String(raw.message ?? "Twelve Data quote error"));
  }

  const quote = normalizeTwelveDataQuote(raw);
  if (!hasQuoteData(quote)) {
    throw new Error("Twelve Data returned no quote data");
  }

  const profile: Record<string, unknown> = {
    ticker: symbol,
    name: raw.name ?? symbol,
    exchange: raw.exchange ?? "",
    currency: raw.currency ?? "",
    country: raw.country ?? "",
  };

  return { quote, profile, provider: "twelvedata" };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const requestId = createRequestId("stocks");
  const providerAttempts: ProviderAttempt[] = [];

  const symbol = (params.symbol ?? "").trim().toUpperCase();
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

  const providerErrors: Record<string, string> = {};

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    const completeAttempt = beginProviderAttempt({
      requestId,
      route: ROUTE_ID,
      provider: "finnhub",
    });

    try {
      const payload = await fetchFromFinnhub(symbol, finnhubKey);
      providerAttempts.push(completeAttempt("ok"));
      return NextResponse.json({
        ...payload,
        meta: {
          requestId,
          providerAttempts,
        },
      });
    } catch (error) {
      providerErrors.finnhub = error instanceof Error ? error.message : "Finnhub request failed";
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
      const payload = await fetchFromTwelveData(symbol, twelveDataKey);
      providerAttempts.push(completeAttempt("ok"));
      return NextResponse.json({
        ...payload,
        meta: {
          requestId,
          providerAttempts,
        },
      });
    } catch (error) {
      providerErrors.twelvedata = error instanceof Error ? error.message : "Twelve Data request failed";
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

  return NextResponse.json(
    {
      error: "Unable to fetch stock data from configured providers",
      symbol,
      providers: providerErrors,
      meta: {
        requestId,
        providerAttempts,
      },
    },
    { status: 502 }
  );
}
