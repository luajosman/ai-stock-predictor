export type ProviderAttemptStatus = "ok" | "error" | "skipped";

export type ProviderAttempt = {
  provider: string;
  status: ProviderAttemptStatus;
  latencyMs: number;
  error?: string;
};

type ProviderRecord = ProviderAttempt & {
  requestId: string;
  route: string;
  at: string;
};

type ObservabilityStore = {
  records: ProviderRecord[];
};

const MAX_RECORDS = 1000;
const DEFAULT_RECENT_LIMIT = 100;

const g = globalThis as typeof globalThis & { __apiObservabilityStore?: ObservabilityStore };
const store: ObservabilityStore = g.__apiObservabilityStore ?? { records: [] };
g.__apiObservabilityStore = store;

function sanitizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  if (typeof error === "string") return error.slice(0, 300);
  return "Unknown error";
}

function appendRecord(record: ProviderRecord) {
  store.records.push(record);
  if (store.records.length > MAX_RECORDS) {
    store.records.splice(0, store.records.length - MAX_RECORDS);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx] ?? 0;
}

function toMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

export function createRequestId(prefix = "req") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function beginProviderAttempt(input: {
  requestId: string;
  route: string;
  provider: string;
}) {
  const startedAt = Date.now();

  return (status: "ok" | "error", error?: unknown): ProviderAttempt => {
    const attempt: ProviderAttempt = {
      provider: input.provider,
      status,
      latencyMs: toMs(startedAt),
      error: status === "error" ? sanitizeErrorMessage(error) : undefined,
    };

    appendRecord({
      ...attempt,
      requestId: input.requestId,
      route: input.route,
      at: nowIso(),
    });

    return attempt;
  };
}

export function recordSkippedProviderAttempt(input: {
  requestId: string;
  route: string;
  provider: string;
  reason: string;
}) {
  const attempt: ProviderAttempt = {
    provider: input.provider,
    status: "skipped",
    latencyMs: 0,
    error: input.reason.slice(0, 300),
  };

  appendRecord({
    ...attempt,
    requestId: input.requestId,
    route: input.route,
    at: nowIso(),
  });

  return attempt;
}

export function getObservabilitySnapshot(limit = DEFAULT_RECENT_LIMIT) {
  const cappedLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  const records = store.records;
  const recent = records.slice(-cappedLimit).reverse();

  const grouped = new Map<
    string,
    {
      route: string;
      provider: string;
      count: number;
      successCount: number;
      errorCount: number;
      skippedCount: number;
      latencies: number[];
      lastError?: string;
    }
  >();

  for (const record of records) {
    const key = `${record.route}|${record.provider}`;
    const existing = grouped.get(key) ?? {
      route: record.route,
      provider: record.provider,
      count: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      latencies: [],
      lastError: undefined,
    };

    existing.count += 1;
    if (record.status === "ok") existing.successCount += 1;
    if (record.status === "error") existing.errorCount += 1;
    if (record.status === "skipped") existing.skippedCount += 1;
    existing.latencies.push(record.latencyMs);
    if (record.status === "error" && record.error) existing.lastError = record.error;

    grouped.set(key, existing);
  }

  const providerMetrics = Array.from(grouped.values())
    .map((item) => ({
      route: item.route,
      provider: item.provider,
      count: item.count,
      successCount: item.successCount,
      errorCount: item.errorCount,
      skippedCount: item.skippedCount,
      avgLatencyMs:
        item.latencies.length > 0
          ? Math.round(item.latencies.reduce((sum, value) => sum + value, 0) / item.latencies.length)
          : 0,
      p95LatencyMs: Math.round(percentile(item.latencies, 95)),
      successRate:
        item.count > 0
          ? Number((item.successCount / item.count).toFixed(3))
          : 0,
      lastError: item.lastError ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route) || a.provider.localeCompare(b.provider));

  const recentErrors = recent
    .filter((record) => record.status === "error")
    .slice(0, 30)
    .map((record) => ({
      requestId: record.requestId,
      route: record.route,
      provider: record.provider,
      error: record.error ?? "Unknown error",
      latencyMs: record.latencyMs,
      at: record.at,
    }));

  return {
    generatedAt: nowIso(),
    totalRecords: records.length,
    providerMetrics,
    recentErrors,
    recentCalls: recent.map((record) => ({
      requestId: record.requestId,
      route: record.route,
      provider: record.provider,
      status: record.status,
      latencyMs: record.latencyMs,
      error: record.error ?? null,
      at: record.at,
    })),
  };
}

export function __clearObservabilityStore() {
  store.records = [];
}
