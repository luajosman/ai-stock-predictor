import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    supports_search: true,
    supports_group_request: false,
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: true,

    // TradingView Resolutions (string):
    // Minuten: "1","5","15","30","60","120","240"
    // Tages/Wochen/Monat: "D","W","M"
    supported_resolutions: ["1", "5", "15", "30", "60", "120", "240", "D", "W", "M"],

    // Symbol types (optional, aber nice)
    symbols_types: [
      { name: "stock", value: "stock" },
      { name: "etf", value: "etf" },
      { name: "index", value: "index" },
      { name: "forex", value: "forex" },
      { name: "crypto", value: "crypto" },
    ],
  });
}
