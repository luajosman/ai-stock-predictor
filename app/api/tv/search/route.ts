import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const query = (searchParams.get("query") || "").trim();
  const limit = Number(searchParams.get("limit") || "10");

  if (!query) return NextResponse.json([]);

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ s: "error", errmsg: "TWELVEDATA_API_KEY missing" }, { status: 500 });
  }

  // Twelve Data symbol_search (best matching symbol)
  // Docs: /symbol_search :contentReference[oaicite:5]{index=5}
  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", query);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("outputsize", String(Math.min(Math.max(limit, 1), 50)));

  const r = await fetch(url.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => null);

  if (!r.ok || !j) return NextResponse.json([]);

  const data: any[] = Array.isArray(j?.data) ? j.data : [];
  const results = data.slice(0, limit).map((it) => ({
    symbol: it.symbol,
    full_name: it.symbol,
    description: it.instrument_name || it.name || it.symbol,
    exchange: it.exchange || it.mic_code || "",
    ticker: it.symbol,
    type: (it.type || it.instrument_type || "stock").toLowerCase(),
  }));

  return NextResponse.json(results);
}
