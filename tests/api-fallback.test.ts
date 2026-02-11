import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as searchRouteGET } from "@/app/api/search/route";
import { GET as stocksRouteGET } from "@/app/api/stocks/[symbol]/route";
import { GET as candlesRouteGET } from "@/app/api/candles/route";
import { __clearObservabilityStore } from "@/lib/api-observability";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isoDateMinusDays(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const envSnapshot = { ...process.env };

describe("API fallback behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const withCache = globalThis as typeof globalThis & {
      __candlesCache?: Map<string, unknown>;
    };
    withCache.__candlesCache?.clear();
    __clearObservabilityStore();
    process.env = { ...envSnapshot };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("falls back to Twelve Data when Finnhub search fails", async () => {
    process.env.FINNHUB_API_KEY = "finnhub-key";
    process.env.TWELVEDATA_API_KEY = "twelve-key";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("finnhub.io/api/v1/search")) {
        return jsonResponse(429, { error: "Rate limit exceeded" });
      }

      if (url.includes("api.twelvedata.com/symbol_search")) {
        return jsonResponse(200, {
          data: [
            {
              symbol: "AAPL",
              instrument_name: "Apple Inc",
              exchange: "NASDAQ",
              type: "Common Stock",
            },
            {
              symbol: "AAPL",
              instrument_name: "Apple Inc",
              exchange: "NASDAQ",
              type: "Common Stock",
            },
          ],
        });
      }

      return jsonResponse(500, { error: `Unexpected URL in test: ${url}` });
    });

    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/search?q=apple");
    const res = await searchRouteGET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.result)).toBe(true);
    expect(json.result[0]?.symbol).toBe("AAPL");
    expect(json.result).toHaveLength(1);
    expect(Array.isArray(json.meta?.providerAttempts)).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "finnhub" && a.status === "error")).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "twelvedata" && a.status === "ok")).toBe(true);
  });

  it("falls back to Twelve Data quote when Finnhub quote is invalid", async () => {
    process.env.FINNHUB_API_KEY = "finnhub-key";
    process.env.TWELVEDATA_API_KEY = "twelve-key";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("finnhub.io/api/v1/quote")) {
        return jsonResponse(200, { c: 0, d: 0, dp: 0 });
      }

      if (url.includes("api.twelvedata.com/quote")) {
        return jsonResponse(200, {
          close: "189.31",
          change: "1.82",
          percent_change: "0.97%",
          high: "190.10",
          low: "186.42",
          open: "187.15",
          previous_close: "187.49",
          timestamp: "1737072000",
          name: "Apple Inc",
          exchange: "NASDAQ",
          currency: "USD",
          country: "US",
        });
      }

      return jsonResponse(500, { error: `Unexpected URL in test: ${url}` });
    });

    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/stocks/AAPL");
    const res = await stocksRouteGET(req, { params: { symbol: "AAPL" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.provider).toBe("twelvedata");
    expect(json.quote.c).toBeCloseTo(189.31, 2);
    expect(Array.isArray(json.meta?.providerAttempts)).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "finnhub" && a.status === "error")).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "twelvedata" && a.status === "ok")).toBe(true);
  });

  it("falls back to Alpha Vantage candles when Finnhub and Twelve Data fail", async () => {
    process.env.FINNHUB_API_KEY = "finnhub-key";
    process.env.TWELVEDATA_API_KEY = "twelve-key";
    process.env.ALPHAVANTAGE_API_KEY = "alpha-key";

    const d1 = isoDateMinusDays(2);
    const d2 = isoDateMinusDays(1);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("finnhub.io/api/v1/stock/candle")) {
        return jsonResponse(200, { s: "no_data" });
      }

      if (url.includes("api.twelvedata.com/time_series")) {
        return jsonResponse(200, { status: "error", message: "Plan limitation" });
      }

      if (url.includes("alphavantage.co/query")) {
        return jsonResponse(200, {
          "Time Series (Daily)": {
            [d1]: {
              "1. open": "100.10",
              "2. high": "103.00",
              "3. low": "99.80",
              "4. close": "102.40",
              "6. volume": "1234567",
            },
            [d2]: {
              "1. open": "102.40",
              "2. high": "104.90",
              "3. low": "101.50",
              "4. close": "104.20",
              "6. volume": "1345678",
            },
          },
        });
      }

      return jsonResponse(500, { error: `Unexpected URL in test: ${url}` });
    });

    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/candles?symbol=AAPL&range=3M");
    const res = await candlesRouteGET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.provider).toBe("alphavantage");
    expect(Array.isArray(json.t)).toBe(true);
    expect(json.t.length).toBeGreaterThan(0);
    expect(Array.isArray(json.meta?.providerAttempts)).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "finnhub" && a.status === "error")).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "twelvedata" && a.status === "error")).toBe(true);
    expect(json.meta.providerAttempts.some((a: { provider: string; status: string }) => a.provider === "alphavantage" && a.status === "ok")).toBe(true);
  });
});
