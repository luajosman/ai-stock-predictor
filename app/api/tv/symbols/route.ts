import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ s: "error", errmsg: "Missing symbol" }, { status: 400 });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ s: "error", errmsg: "TWELVEDATA_API_KEY missing" }, { status: 500 });
  }

  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("outputsize", "1");

  const r = await fetch(url.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => null);

  const it = Array.isArray(j?.data) && j.data.length ? j.data[0] : null;

  // Fallback: trotzdem etwas liefern, damit das Chart nicht crasht
  const exchange = it?.exchange || it?.mic_code || "";
  const description = it?.instrument_name || it?.name || symbol;
  const type = (it?.type || it?.instrument_type || "stock").toLowerCase();

  return NextResponse.json({
    name: symbol,
    ticker: symbol,
    description,
    type,

    // Für einen Start: 24x7 + UTC (stabil, aber nicht börsenstunden-genau)
    session: "24x7",
    timezone: "Etc/UTC",

    exchange,
    listed_exchange: exchange,

    // Preisskalierung: 100 => 2 Nachkommastellen (reicht für die meisten Aktien)
    minmov: 1,
    pricescale: 100,

    has_intraday: true,
    supported_resolutions: ["1", "5", "15", "30", "60", "120", "240", "D", "W", "M"],
    volume_precision: 0,
    data_status: "streaming",
  });
}
