import { NextRequest, NextResponse } from "next/server";
import {
  ProviderAttempt,
  beginProviderAttempt,
  createRequestId,
  recordSkippedProviderAttempt,
} from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_ID = "/api/search";

type Provider = "finnhub" | "twelvedata";

type SearchItem = {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
};

type Candidate = {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
  exchange: string;
  provider: Provider;
};

type RankedCandidate = Candidate & {
  score: number;
  companyKey: string;
};

const BLOCKED_TYPE_HINTS = [
  "forex",
  "currency",
  "crypto",
  "index",
  "future",
  "option",
  "bond",
  "warrant",
  "cfd",
];

const LOW_PRIORITY_HINTS = [
  "leveraged",
  "inverse",
  "ultra",
  "short",
  "3x",
  "2x",
  "-1x",
  "-2x",
  "daily x",
  "daily short",
];

const PREFERRED_EXCHANGE_BONUS: Record<string, number> = {
  NASDAQ: 62,
  NYSE: 60,
  AMEX: 52,
  XETR: 48,
  LSE: 46,
  EURONEXT: 45,
  SIX: 44,
  TSE: 43,
  HKEX: 42,
  SSE: 40,
  SZSE: 40,
  NSE: 39,
  BSE: 39,
  TSX: 38,
  ASX: 38,
};

const CORPORATE_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "group",
  "holdings",
  "holding",
  "limited",
  "ltd",
  "plc",
  "ag",
  "sa",
  "nv",
  "se",
  "spa",
  "srl",
  "llc",
  "pte",
  "the",
]);

const POPULAR_STOCK_HINTS: Array<{ symbol: string; aliases: string[] }> = [
  { symbol: "AAPL", aliases: ["apple", "apple inc"] },
  { symbol: "MSFT", aliases: ["microsoft", "microsoft corp", "microsoft corporation"] },
  { symbol: "GOOGL", aliases: ["google", "alphabet", "alphabet inc"] },
  { symbol: "AMZN", aliases: ["amazon", "amazon com", "amazon.com"] },
  { symbol: "NVDA", aliases: ["nvidia", "nvidia corp", "nvidia corporation"] },
  { symbol: "TSLA", aliases: ["tesla", "tesla inc"] },
  { symbol: "META", aliases: ["meta", "meta platforms", "facebook"] },
  { symbol: "NFLX", aliases: ["netflix"] },
  { symbol: "BRK.B", aliases: ["berkshire", "berkshire hathaway"] },
  { symbol: "JPM", aliases: ["jpmorgan", "jpmorgan chase"] },
];

function cleanQuery(raw: string | null) {
  return (raw ?? "").trim();
}

function parseLimit(raw: string | null) {
  const n = Number(raw ?? "10");
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(Math.floor(n), 1), 25);
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeExchange(value: string) {
  return value.trim().toUpperCase();
}

function sanitizeSymbol(value: string) {
  let symbol = value.trim().toUpperCase();
  if (!symbol) return "";

  if (symbol.includes(":")) {
    const parts = symbol.split(":");
    symbol = parts[parts.length - 1] ?? symbol;
  }

  return symbol.replace(/\s+/g, "");
}

function symbolBase(symbol: string) {
  const s = sanitizeSymbol(symbol);
  return s.split(".")[0] ?? s;
}

function isTickerLikeQuery(query: string) {
  const q = query.trim().toUpperCase();
  return /^[A-Z0-9]{1,6}(\.[A-Z0-9]{1,4})?$/.test(q);
}

function stockTypeAllowed(type: string, description: string) {
  const t = normalizeText(type);
  const d = normalizeText(description);

  if (!t) {
    return !BLOCKED_TYPE_HINTS.some((hint) => d.includes(hint));
  }

  if (BLOCKED_TYPE_HINTS.some((hint) => t.includes(hint))) return false;

  return (
    t.includes("stock") ||
    t.includes("equity") ||
    t.includes("share") ||
    t.includes("adr") ||
    t.includes("etf") ||
    t.includes("etp") ||
    t.includes("reit")
  );
}

function normalizeCompanyName(description: string) {
  const normalized = normalizeText(description);
  if (!normalized) return "";

  const tokens = normalized.split(" ").filter(Boolean);
  while (tokens.length > 0 && CORPORATE_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ");
}

function makeCompanyKey(description: string, symbol: string) {
  const byName = normalizeCompanyName(description);
  if (byName.length >= 3) return `name:${byName}`;
  return `symbol:${symbolBase(symbol)}`;
}

function exchangeBonus(exchange: string) {
  const ex = normalizeExchange(exchange);
  if (!ex) return 0;
  return PREFERRED_EXCHANGE_BONUS[ex] ?? 22;
}

function popularHintBoost(item: Candidate, queryNorm: string) {
  if (!queryNorm || queryNorm.length < 2) return 0;

  const base = symbolBase(item.symbol);
  let boost = 0;

  for (const hint of POPULAR_STOCK_HINTS) {
    if (symbolBase(hint.symbol) !== base) continue;

    for (const alias of hint.aliases) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) continue;

      if (normalizedAlias === queryNorm) {
        boost = Math.max(boost, 1400);
        continue;
      }

      if (normalizedAlias.startsWith(queryNorm) && queryNorm.length >= 2) {
        boost = Math.max(boost, 980);
        continue;
      }

      if (queryNorm.startsWith(normalizedAlias) && normalizedAlias.length >= 3) {
        boost = Math.max(boost, 520);
      }
    }
  }

  return boost;
}

function scoreCandidate(item: Candidate, query: string) {
  const qUpper = query.trim().toUpperCase();
  const qNorm = normalizeText(query);
  const symbol = item.symbol;
  const display = item.displaySymbol.toUpperCase();
  const desc = normalizeText(item.description);

  const descWords = desc.split(" ").filter(Boolean);
  const qWords = qNorm.split(" ").filter(Boolean);
  const wholeWordMatch = descWords.includes(qNorm);
  const wordPrefixMatch = qNorm.length >= 3 && descWords.some((word) => word.startsWith(qNorm));

  let score = 0;

  if (symbol === qUpper || display === qUpper) score += 1500;
  else if (symbol.startsWith(qUpper) || display.startsWith(qUpper)) score += 1050;
  else if (symbolBase(symbol) === qUpper) score += 980;
  else if ((symbol.includes(qUpper) || display.includes(qUpper)) && qUpper.length >= 2) score += 500;

  if (desc === qNorm) score += 980;
  if (desc === qNorm || desc.startsWith(`${qNorm} `)) score += 760;
  else if (desc.startsWith(qNorm) && qNorm.length >= 3) score += 620;

  if (wholeWordMatch) score += 300;
  if (wordPrefixMatch) score += 170;

  if (qWords.length > 1) {
    const allWordsMatch = qWords.every((token) => descWords.some((word) => word.startsWith(token)));
    if (allWordsMatch) score += 520;
    else if (qWords.some((token) => desc.includes(token))) score += 120;
  }

  if (!wholeWordMatch && !wordPrefixMatch && qNorm.length >= 4 && desc.includes(qNorm)) {
    // Penalize substring-only matches such as "apple" inside "pineapple".
    score -= 220;
  }

  score += exchangeBonus(item.exchange);
  score += item.provider === "finnhub" ? 26 : 18;
  score += popularHintBoost(item, qNorm);

  const typeNorm = normalizeText(item.type);
  if (typeNorm.includes("common stock")) score += 35;
  if (typeNorm.includes("stock")) score += 18;
  if (typeNorm.includes("adr")) score += 8;

  if (symbol.includes(".")) score += 4;

  const nameLength = descWords.length;
  if (nameLength > 6) score -= (nameLength - 6) * 18;
  if (nameLength > 10) score -= 35;

  const lowPriorityText = `${typeNorm} ${desc}`;
  if (LOW_PRIORITY_HINTS.some((hint) => lowPriorityText.includes(hint))) {
    score -= 420;
  }

  return score;
}

function formatType(type: string, exchange: string) {
  const base = type.trim() || "stock";
  const ex = normalizeExchange(exchange);
  return ex ? `${base} · ${ex}` : base;
}

function sanitizeCandidate(item: Candidate): Candidate | null {
  const symbol = sanitizeSymbol(item.symbol);
  const description = item.description.trim();
  const displaySymbol = sanitizeSymbol(item.displaySymbol || symbol) || symbol;
  const type = item.type.trim() || "stock";
  const exchange = normalizeExchange(item.exchange);

  if (!symbol || !description) return null;
  if (symbol.includes("/")) return null;
  if (!stockTypeAllowed(type, description)) return null;

  return {
    symbol,
    displaySymbol,
    description,
    type,
    exchange,
    provider: item.provider,
  };
}

function applyScoreCutoff(sorted: RankedCandidate[], query: string, limit: number) {
  if (sorted.length === 0) return [];
  if (sorted.length === 1) return sorted;

  const topScore = sorted[0].score;
  const secondScore = sorted[1]?.score ?? sorted[0].score;
  const lead = topScore - secondScore;
  const tickerQuery = isTickerLikeQuery(query);

  if (!tickerQuery && lead >= 500) {
    return sorted.filter((item) => item.score >= topScore - 160).slice(0, limit);
  }

  const minScore = tickerQuery
    ? Math.max(topScore - 520, 90)
    : Math.max(topScore - 340, 180);

  const filtered = sorted.filter((item) => item.score >= minScore);
  if (filtered.length >= Math.min(limit, 3)) {
    return filtered.slice(0, limit);
  }

  return sorted.slice(0, limit);
}

function rankAndDeduplicate(candidates: Candidate[], query: string, limit: number): SearchItem[] {
  const ranked: RankedCandidate[] = candidates
    .map((item) => ({
      ...item,
      score: scoreCandidate(item, query),
      companyKey: makeCompanyKey(item.description, item.symbol),
    }))
    .sort((a, b) => b.score - a.score);

  const byCompany = new Map<string, RankedCandidate>();
  for (const item of ranked) {
    const existing = byCompany.get(item.companyKey);
    if (!existing || item.score > existing.score) {
      byCompany.set(item.companyKey, item);
    }
  }

  const dedupedByCompany = Array.from(byCompany.values()).sort((a, b) => b.score - a.score);
  const filteredByQuality = applyScoreCutoff(dedupedByCompany, query, limit);

  const uniqueBySymbol = new Set<string>();
  const output: SearchItem[] = [];

  for (const item of filteredByQuality) {
    if (uniqueBySymbol.has(item.symbol)) continue;
    uniqueBySymbol.add(item.symbol);

    output.push({
      symbol: item.symbol,
      displaySymbol: item.displaySymbol || item.symbol,
      description: item.description,
      type: formatType(item.type, item.exchange),
    });

    if (output.length >= limit) break;
  }

  return output;
}

async function searchFinnhub(query: string, apiKey: string): Promise<Candidate[]> {
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "error" in data ? String((data as { error?: string }).error ?? "") : "";
    throw new Error(detail || `Finnhub search failed (${res.status})`);
  }

  const rows = Array.isArray((data as { result?: unknown[] } | null)?.result)
    ? ((data as { result: Array<Record<string, unknown>> }).result ?? [])
    : [];

  return rows
    .filter((row) => typeof row?.symbol === "string" && typeof row?.description === "string")
    .map((row) => ({
      symbol: String(row.symbol),
      displaySymbol: String(row.displaySymbol ?? row.symbol),
      description: String(row.description ?? row.symbol),
      type: String(row.type ?? "stock"),
      exchange: String(row.exchange ?? row.mic ?? row.micCode ?? ""),
      provider: "finnhub" as const,
    }));
}

async function searchTwelveData(query: string, apiKey: string): Promise<Candidate[]> {
  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", query);
  url.searchParams.set("outputsize", "40");
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
    exchange: String(row.exchange ?? row.mic_code ?? ""),
    provider: "twelvedata" as const,
  }));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = cleanQuery(url.searchParams.get("q"));
  const limit = parseLimit(url.searchParams.get("limit"));
  if (!query) return NextResponse.json({ result: [] });

  const requestId = createRequestId("search");
  const providerErrors: Record<string, string> = {};
  const providerAttempts: ProviderAttempt[] = [];
  const tasks: Array<
    Promise<
      | { provider: Provider; ok: true; items: Candidate[]; attempt: ProviderAttempt }
      | { provider: Provider; ok: false; error: string; attempt: ProviderAttempt }
    >
  > = [];

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    const completeAttempt = beginProviderAttempt({
      requestId,
      route: ROUTE_ID,
      provider: "finnhub",
    });

    tasks.push(
      searchFinnhub(query, finnhubKey)
        .then((items) => ({
          provider: "finnhub" as const,
          ok: true as const,
          items,
          attempt: completeAttempt("ok"),
        }))
        .catch((error) => ({
          provider: "finnhub" as const,
          ok: false as const,
          error: error instanceof Error ? error.message : "Finnhub search failed",
          attempt: completeAttempt("error", error),
        }))
    );
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

    tasks.push(
      searchTwelveData(query, twelveDataKey)
        .then((items) => ({
          provider: "twelvedata" as const,
          ok: true as const,
          items,
          attempt: completeAttempt("ok"),
        }))
        .catch((error) => ({
          provider: "twelvedata" as const,
          ok: false as const,
          error: error instanceof Error ? error.message : "Twelve Data search failed",
          attempt: completeAttempt("error", error),
        }))
    );
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

  if (tasks.length === 0) {
    return NextResponse.json(
      {
        result: [],
        error: "Search provider unavailable",
        providers: providerErrors,
        meta: {
          requestId,
          providerAttempts,
        },
      },
      { status: 502 }
    );
  }

  const settled = await Promise.all(tasks);
  const allCandidates: Candidate[] = [];
  let providerSucceeded = false;

  for (const entry of settled) {
    providerAttempts.push(entry.attempt);
    if (entry.ok) {
      providerSucceeded = true;
      allCandidates.push(...entry.items);
    } else {
      providerErrors[entry.provider] = entry.error;
    }
  }

  const sanitized = allCandidates
    .map((item) => sanitizeCandidate(item))
    .filter((item): item is Candidate => item !== null);

  const result = rankAndDeduplicate(sanitized, query, limit);
  if (result.length > 0 || providerSucceeded) {
    return NextResponse.json({
      result,
      meta: {
        requestId,
        providerAttempts,
      },
    });
  }

  return NextResponse.json(
    {
      result: [],
      error: "Search provider unavailable",
      providers: providerErrors,
      meta: {
        requestId,
        providerAttempts,
      },
    },
    { status: 502 }
  );
}
