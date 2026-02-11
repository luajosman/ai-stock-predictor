import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FINNHUB_TYPES = new Set(["Common Stock", "ADR", "ETF", "ETP"]);

type SearchItem = {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
};

function cleanQuery(raw: string | null) {
  return (raw ?? "").trim();
}

function sanitizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeAndLimit(items: SearchItem[], limit = 10) {
  const seen = new Set<string>();
  const output: SearchItem[] = [];

  for (const item of items) {
    const symbol = sanitizeSymbol(item.symbol);
    if (!symbol) continue;
    if (symbol.includes(":") || symbol.includes("/")) continue;
    if (seen.has(symbol)) continue;

    seen.add(symbol);
    output.push({
      symbol,
      displaySymbol: item.displaySymbol || symbol,
      description: item.description || symbol,
      type: item.type || "",
    });

    if (output.length >= limit) break;
  }

  return output;
}

async function searchFinnhub(query: string, apiKey: string): Promise<SearchItem[]> {
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "error" in data ? String((data as { error?: string }).error ?? "") : "";
    throw new Error(detail || `Finnhub search failed (${res.status})`);
  }

  const result = Array.isArray((data as { result?: unknown[] } | null)?.result)
    ? ((data as { result: Array<Record<string, unknown>> }).result ?? [])
    : [];

  return result
    .filter((row) => typeof row?.symbol === "string" && typeof row?.description === "string")
    .filter((row) => (typeof row?.type === "string" ? ALLOWED_FINNHUB_TYPES.has(row.type) : true))
    .map((row) => ({
      symbol: String(row.symbol),
      displaySymbol: String(row.displaySymbol ?? row.symbol),
      description: String(row.description),
      type: String(row.type ?? ""),
    }));
}

async function searchTwelveData(query: string, apiKey: string): Promise<SearchItem[]> {
  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", query);
  url.searchParams.set("outputsize", "20");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`Twelve Data search failed (${res.status})`);

  if (typeof data === "object" && data && "status" in data && (data as { status?: string }).status === "error") {
    const message =
      "message" in data ? String((data as { message?: string }).message ?? "Twelve Data search failed") : "Twelve Data search failed";
    throw new Error(message);
  }

  const rows = Array.isArray((data as { data?: unknown[] }).data)
    ? ((data as { data: Array<Record<string, unknown>> }).data ?? [])
    : [];

  return rows.map((row) => ({
    symbol: String(row.symbol ?? ""),
    displaySymbol: String(row.symbol ?? ""),
    description: String(row.instrument_name ?? row.name ?? row.symbol ?? ""),
    type: String(row.type ?? row.instrument_type ?? "stock"),
  }));
}

export async function GET(req: NextRequest) {
  const query = cleanQuery(new URL(req.url).searchParams.get("q"));
  if (!query) return NextResponse.json({ result: [] });

  const providerErrors: Record<string, string> = {};

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const result = normalizeAndLimit(await searchFinnhub(query, finnhubKey), 10);
      if (result.length > 0) return NextResponse.json({ result });
      providerErrors.finnhub = "No matching symbols";
    } catch (error) {
      providerErrors.finnhub = error instanceof Error ? error.message : "Finnhub search failed";
    }
  } else {
    providerErrors.finnhub = "FINNHUB_API_KEY missing";
  }

  const twelveDataKey = process.env.TWELVEDATA_API_KEY;
  if (twelveDataKey) {
    try {
      const result = normalizeAndLimit(await searchTwelveData(query, twelveDataKey), 10);
      return NextResponse.json({ result });
    } catch (error) {
      providerErrors.twelvedata = error instanceof Error ? error.message : "Twelve Data search failed";
    }
  } else {
    providerErrors.twelvedata = "TWELVEDATA_API_KEY missing";
  }

  return NextResponse.json(
    {
      result: [],
      error: "Search provider unavailable",
      providers: providerErrors,
    },
    { status: 502 }
  );
}
