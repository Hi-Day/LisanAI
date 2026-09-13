const { getDb } = require("./database");
const pricing = require("./ai/pricing");

const RANGE_MS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

function percentile(values, p) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.ceil((p / 100) * values.length) - 1);
  return Math.round(values[Math.max(0, index)]);
}

function formatUsd(value) {
  return value == null ? null : Number(Number(value).toFixed(5));
}

async function getObservabilitySnapshot(tenantId, query = {}) {
  const db = getDb();
  const range = query.range in RANGE_MS ? query.range : "24h";
  const rangeMs = RANGE_MS[range];
  const since = rangeMs == null ? null : new Date(Date.now() - rangeMs).toISOString();
  const sinceClause = since ? " AND created_at > ?" : "";
  const sinceParams = since ? [since] : [];

  const stats = await db.get(`SELECT COUNT(*) total_calls,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) error_calls,
      SUM(retry_count) total_retries,
      AVG(CASE WHEN status = 'success' THEN latency_ms END) avg_latency,
      SUM(prompt_tokens) prompt_tokens,
      SUM(completion_tokens) completion_tokens,
      SUM(total_tokens) total_tokens,
      SUM(COALESCE(cost_usd, 0)) total_cost_usd
    FROM ai_logs WHERE tenant_id = ?${sinceClause}`, tenantId, ...sinceParams);

  const latencyRows = await db.all(`SELECT latency_ms FROM ai_logs
    WHERE tenant_id = ? AND status = 'success' AND latency_ms IS NOT NULL${sinceClause}
    ORDER BY latency_ms ASC`, tenantId, ...sinceParams);
  const latencies = latencyRows.map((row) => Number(row.latency_ms)).filter(Number.isFinite);
  const totalCalls = Number(stats?.total_calls || 0);
  const errorCalls = Number(stats?.error_calls || 0);
  const totalTokens = Number(stats?.total_tokens || 0);
  const promptTokens = Number(stats?.prompt_tokens || 0);
  const completionTokens = Number(stats?.completion_tokens || 0);

  const metrics = {
    totalCalls,
    callsToday: totalCalls,
    errorCalls,
    errorRate: totalCalls ? Math.round((errorCalls / totalCalls) * 1000) / 10 : 0,
    totalRetries: Number(stats?.total_retries || 0),
    retryRate: totalCalls ? Math.round((Number(stats?.total_retries || 0) / totalCalls) * 1000) / 10 : 0,
    avgLatencyMs: stats?.avg_latency == null ? null : Math.round(Number(stats.avg_latency)),
    p50LatencyMs: percentile(latencies, 50),
    p75LatencyMs: percentile(latencies, 75),
    p90LatencyMs: percentile(latencies, 90),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    promptTokens,
    completionTokens,
    totalTokens,
    promptTokenPct: totalTokens ? Math.round((promptTokens / totalTokens) * 1000) / 10 : 0,
    completionTokenPct: totalTokens ? Math.round((completionTokens / totalTokens) * 1000) / 10 : 0,
    avgTokensPerRequest: totalCalls ? Math.round(totalTokens / totalCalls) : 0,
    estimatedCostUSD: formatUsd(stats?.total_cost_usd || 0),
    costPer1KTokens: totalTokens ? formatUsd((Number(stats?.total_cost_usd || 0) / totalTokens) * 1000) : null,
    cacheEfficiencyPercent: null,
  };

  const latencyDistribution = [
    ["0-5s", 0, 5000], ["5-10s", 5000, 10000], ["10-30s", 10000, 30000],
    ["30-60s", 30000, 60000], ["60-120s", 60000, 120000], ["120s+", 120000, Infinity],
  ].map(([label, min, max]) => ({ label, min, count: latencies.filter((value) => value >= min && value < max).length }));

  const opRows = await db.all(`SELECT action, COUNT(*) calls,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) errors,
      AVG(latency_ms) avg_latency
    FROM ai_logs WHERE tenant_id = ?${sinceClause}
    GROUP BY action ORDER BY calls DESC`, tenantId, ...sinceParams);
  const latencyByOperation = opRows.map((row) => ({
    operation: row.action,
    calls: Number(row.calls || 0),
    avg: row.avg_latency == null ? null : Math.round(Number(row.avg_latency)),
    errorRate: row.calls ? Math.round((Number(row.errors || 0) / Number(row.calls)) * 1000) / 10 : 0,
  }));

  const providerRows = await db.all(`SELECT model, COUNT(*) calls,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) errors,
      SUM(total_tokens) tokens, SUM(COALESCE(cost_usd, 0)) cost
    FROM ai_logs WHERE tenant_id = ? AND model IS NOT NULL AND model != ''${sinceClause}
    GROUP BY model ORDER BY calls DESC LIMIT 10`, tenantId, ...sinceParams);
  const providerPerformance = providerRows.map((row) => ({
    model: row.model,
    calls: Number(row.calls || 0),
    totalTokens: Number(row.tokens || 0),
    estimatedCostUSD: formatUsd(row.cost || 0),
    errors: Number(row.errors || 0),
    errorRate: row.calls ? Math.round((Number(row.errors || 0) / Number(row.calls)) * 1000) / 10 : 0,
  }));

  const logs = await db.all(`SELECT id, action, model, prompt_tokens, completion_tokens, total_tokens,
      latency_ms, status, error_message, estimated_prefix_cache_savings,
      cache_read_input_tokens, cache_creation_input_tokens, kv_cache_measured,
      retry_count, cost_usd, created_at
    FROM ai_logs WHERE tenant_id = ?${sinceClause}
    ORDER BY created_at DESC LIMIT 100`, tenantId, ...sinceParams);

  return {
    metrics,
    latencyDistribution,
    latencyByOperation,
    costByOperation: [],
    tailLatency: { ratio: metrics.p50LatencyMs && metrics.p95LatencyMs ? Number((metrics.p95LatencyMs / metrics.p50LatencyMs).toFixed(1)) : null, p50: metrics.p50LatencyMs, p95: metrics.p95LatencyMs, threshold: 5, flagged: false },
    providerPerformance,
    slowestCalls: [],
    prefixOptimization: { eligiblePromptTokens: 0, estimatedSavingsTokens: 0, estimatedSavingsUSD: null },
    system: { uptimeSeconds: Math.floor(process.uptime()), memory: process.memoryUsage() },
    telemetryType: "actual+derived+estimated",
    modelUsage: providerPerformance.map((item) => ({ model: item.model, calls: item.calls })),
    contextCache: { hits: 0, misses: 0, size: 0 },
    riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, none: 0 },
    logs,
    logFilters: { operations: opRows.map((row) => row.action), models: providerRows.map((row) => row.model) },
    pagination: { limit: 100, offset: 0, total: logs.length },
    range,
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getObservabilitySnapshot, formatUsd, pricing };
