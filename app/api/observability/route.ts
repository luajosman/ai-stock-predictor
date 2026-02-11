import { NextRequest, NextResponse } from "next/server";
import { getObservabilitySnapshot } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = Number(limitRaw ?? "100");

  return NextResponse.json(getObservabilitySnapshot(limit));
}
