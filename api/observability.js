const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { getDb } = require("../server/database");
const { parseCookies, sendJson } = require("../server/http-utils");

/**
 * Observability API (admin only) — PRD Observability & Research Redesign v1.0.
 *
 * Every metric carries an explicit semantic classification:
 *   actual    — directly measured by system/provider
 *   estimated — calculated from available information
 *   derived   — calculated from actual telemetry
 *   research  — experimental/analytical metric
 *
 * GET /api/observability?range=1h|24h|7d|30d|all
 *                      &operation=...&model=...&status=...&latency=gt_sec&dateFrom=YYYY-MM-DD&limit=&offset=
 */

const RANGE_MS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

// Pricing estimation (per 1K tokens). Same constants as server/openrouter.js.
const PROMPT_PRICE_PER_K = 0.0015;
const COMPLETION_PRICE_PER_K = 0.0020;

// Tail-latency alert threshold: flag when p95 = threshold × p50 (derived metric).
const TAIL_LATENCY_THRESHOLD = 5;

// Restart monitoring: uptime below this (seconds) flags "recently restarted".
const RESTART_THRESHOLD_SECONDS = Number(process.env.OBSERVABILITY_RESTART_THRESHOLD_SECONDS || 3600);

function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return Math.round(sortedArr[Math.max(0, idx)]);
}

function sum(xs) {
  return xs.reduce((a, b) => a + (b || 0), 0);
}

function formatUsd(v) {
  return v == null ? null : parseFloat(Number(v).toFixed(5));
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.role !== "admin") {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const range = url.searchParams.get("range") || "24h";
    const rangeMs = RANGE_MS[range] ?? RANGE_MS["24h"];
    const operation = url.searchParams.get("operation") || "";
    const modelFilter = url.searchParams.get("model") || "";
    const statusFilter = url.searchParams.get("status") || "";
    const latencyGtSec = Number(url.searchParams.get("latency") || 0);
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    const since = rangeMs == null ? null : new Date(Date.now() - rangeMs).toISOString();
    const sinceClause = since ? "AND created_at > ?" : "";
    const sinceParams = since ? [since] : [];

    const db = getDb();
    const tenantId = auth.tenant.id;

    // ---------------------------------------------------------------
    // 1. Aggregate stats (KPI)
    // ---------------------------------------------------------------
    const statsQuery = await db.get(
      `SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_calls,
        SUM(retry_count) as total_retries,
        AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as avg_latency,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(CASE WHEN action LIKE 'evaluate%' THEN total_tokens END) as evaluation_tokens,
        SUM(CASE WHEN action LIKE 'evaluate%' THEN 1 ELSE 0 END) as evaluation_calls,
        SUM(estimated_prefix_cache_savings) as total_estimated_prefix_cache_savings,
        SUM(CASE WHEN status = 'success' THEN prompt_tokens ELSE NULL END) as eligible_prompt_tokens,
        SUM(cache_read_input_tokens) as total_cache_read_input_tokens,
        SUM(cache_creation_input_tokens) as total_cache_creation_input_tokens,
        SUM(COALESCE(cost_usd, 0)) as total_cost_usd,
        MAX(CASE WHEN kv_cache_measured = 1 THEN 1 ELSE 0 END) as kv_cache_measured
       FROM ai_logs
       WHERE tenant_id = ? ${sinceClause}`,
      [tenantId, ...sinceParams]
    );

    const totalCalls = statsQuery?.total_calls || 0;
    const errorCalls = statsQuery?.error_calls || 0;
    const errorRate = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 1000) / 10 : 0;
    const totalRetries = statsQuery?.total_retries || 0;
    const retryRate = totalCalls > 0 ? Math.round((totalRetries / totalCalls) * 1000) / 10 : 0;
    const promptTokens = statsQuery?.total_prompt_tokens || 0;
    const completionTokens = statsQuery?.total_completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const estimatedPrefixCacheSavings = statsQuery?.total_estimated_prefix_cache_savings || 0;
    const eligiblePromptTokens = statsQuery?.eligible_prompt_tokens || 0;
    const cacheReadInputTokens = statsQuery?.total_cache_read_input_tokens || 0;
    const cacheCreationInputTokens = statsQuery?.total_cache_creation_input_tokens || 0;
    const estimatedCostUSD = formatUsd(statsQuery?.total_cost_usd || 0);
    const kvCacheAvailable = !!statsQuery?.kv_cache_measured;

    const evaluationCalls = statsQuery?.evaluation_calls || 0;
    const evaluationTokens = statsQuery?.evaluation_tokens || 0;

    // Calls logged today (local day), used for the "+N today" delta.
    let callsToday = null;
    if (since != null) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayRow = await db.get(
        "SELECT COUNT(*) as c FROM ai_logs WHERE tenant_id = ? AND created_at > ?",
        [tenantId, todayStart.toISOString()]
      );
      callsToday = todayRow?.c || 0;
    }

    // ---------------------------------------------------------------
    // 2. Latency percentiles (p50/p75/p90/p95/p99) — derived from the raw
    //    latency distribution, never from averages. (PRD §8, §9)
    // ---------------------------------------------------------------
    const latencyRows = await db.all(
      `SELECT latency_ms FROM ai_logs
       WHERE tenant_id = ? AND status = 'success' AND latency_ms IS NOT NULL ${sinceClause}
       ORDER BY latency_ms ASC`,
      [tenantId, ...sinceParams]
    );
    const latencies = latencyRows.map((row) => row.latency_ms);
    const p50 = percentile(latencies, 50);
    const p75 = percentile(latencies, 75);
    const p90 = percentile(latencies, 90);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);

    // ---------------------------------------------------------------
    // 3. Latency distribution histogram (heavy-tail visibility, PRD §8.1)
    // ---------------------------------------------------------------
    const buckets = [
      { label: "0-5s", min: 0, max: 5000 },
      { label: "5-10s", min: 5000, max: 10000 },
      { label: "10-30s", min: 10000, max: 30000 },
      { label: "30-60s", min: 30000, max: 60000 },
      { label: "60-120s", min: 60000, max: 120000 },
      { label: "120s+", min: 120000, max: Infinity },
    ];
    const latencyDistribution = buckets.map((b) => {
      const rowsInBucket = latencies.filter((lat) => lat >= b.min && lat < b.max && lat !== null);
      return { label: b.label, min: b.min, count: rowsInBucket.length };
    });
    const latencyDistMax = Math.max(1, ...latencyDistribution.map((b) => b.count));

    // ---------------------------------------------------------------
    // 4. Tail latency (derived diagnostic, PRD §10)
    // ---------------------------------------------------------------
    const tailRatio = p50 && p95 ? Math.round((p95 / p50) * 10) / 10 : null;
    const tailLatency = {
      ratio: tailRatio,
      p50: p50 ?? null,
      p95: p95 ?? null,
      threshold: TAIL_LATENCY_THRESHOLD,
      flagged: tailRatio != null && tailRatio > TAIL_LATENCY_THRESHOLD,
    };

    // ---------------------------------------------------------------
    // 5. Latency by operation (PRD §11) — bottleneck identification.
    // ---------------------------------------------------------------
    const opRows = await db.all(
      `SELECT action, COUNT(*) as calls,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
              AVG(latency_ms) as avg_latency
         FROM ai_logs
        WHERE tenant_id = ? ${sinceClause}
        GROUP BY action
        ORDER BY avg_latency DESC`,
      [tenantId, ...sinceParams]
    );
    const latencyByOperation = [];
    for (const row of opRows) {
      const opLatencies = await db.all(
        `SELECT latency_ms FROM ai_logs
          WHERE tenant_id = ? AND action = ? AND status = 'success' AND latency_ms IS NOT NULL ${sinceClause}
          ORDER BY latency_ms ASC`,
        [tenantId, row.action, ...sinceParams]
      );
      const opArr = opLatencies.map((r) => r.latency_ms);
      latencyByOperation.push({
        operation: row.action,
        calls: row.calls,
        p50: percentile(opArr, 50),
        p95: percentile(opArr, 95),
        avg: row.avg_latency != null ? Math.round(row.avg_latency) : null,
        errorRate: row.calls > 0 ? Math.round((row.errors / row.calls) * 1000) / 10 : 0,
      });
    }

    // ---------------------------------------------------------------
    // 6. Cost by operation (PRD §15)
    // ---------------------------------------------------------------
    const costByOpRows = await db.all(
      `SELECT action, COUNT(*) as calls,
              SUM(total_tokens) as tokens,
              SUM(COALESCE(cost_usd, 0)) as cost
         FROM ai_logs
        WHERE tenant_id = ? ${sinceClause}
        GROUP BY action
        ORDER BY cost DESC`,
      [tenantId, ...sinceParams]
    );
    const costByOperation = costByOpRows.map((row) => ({
      operation: row.action,
      calls: row.calls,
      tokens: row.tokens || 0,
      estimatedCostUSD: formatUsd(row.cost || 0),
    }));

    // ---------------------------------------------------------------
    // 7. AI provider performance (PRD §20) — prepares model comparison.
    // ---------------------------------------------------------------
    const providerRows = await db.all(
      `SELECT model, COUNT(*) as calls,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
              SUM(total_tokens) as tokens,
              SUM(COALESCE(cost_usd, 0)) as cost
         FROM ai_logs
        WHERE tenant_id = ? AND model IS NOT NULL AND model != '' ${sinceClause}
        GROUP BY model
        ORDER BY calls DESC
        LIMIT 10`,
      [tenantId, ...sinceParams]
    );
    const providerPerformance = [];
    for (const row of providerRows) {
      const modelLatencies = await db.all(
        `SELECT latency_ms FROM ai_logs
          WHERE tenant_id = ? AND model = ? AND status = 'success' AND latency_ms IS NOT NULL ${sinceClause}
          ORDER BY latency_ms ASC`,
        [tenantId, row.model, ...sinceParams]
      );
      const mArr = modelLatencies.map((r) => r.latency_ms);
      providerPerformance.push({
        model: row.model,
        calls: row.calls,
        p50: percentile(mArr, 50),
        p95: percentile(mArr, 95),
        totalTokens: row.tokens || 0,
        estimatedCostUSD: formatUsd(row.cost || 0),
        errors: row.errors,
        errorRate: row.calls > 0 ? Math.round((row.errors / row.calls) * 1000) / 10 : 0,
      });
    }

    // ---------------------------------------------------------------
    // 8. Slowest calls (PRD §21)
    // ---------------------------------------------------------------
    const slowestCalls = await db.all(
      `SELECT id, action, model, latency_ms, prompt_tokens, completion_tokens, total_tokens,
              status, error_message, estimated_prefix_cache_savings, cost_usd, created_at
         FROM ai_logs
        WHERE tenant_id = ? ${sinceClause}
        ORDER BY latency_ms DESC
        LIMIT 10`,
      [tenantId, ...sinceParams]
    );

    // ---------------------------------------------------------------
    // 9. Log filters + pagination (PRD §22-§23, §44)
    // ---------------------------------------------------------------
    const filterClauses = ["tenant_id = ?"];
    const filterParams = [tenantId];
    if (since) {
      filterClauses.push("created_at > ?");
      filterParams.push(since);
    }
    if (operation) {
      filterClauses.push("action = ?");
      filterParams.push(operation);
    }
    if (modelFilter) {
      filterClauses.push("model = ?");
      filterParams.push(modelFilter);
    }
    if (statusFilter) {
      filterClauses.push("status = ?");
      filterParams.push(statusFilter);
    }
    if (latencyGtSec > 0) {
      filterClauses.push("latency_ms > ?");
      filterParams.push(latencyGtSec * 1000);
    }
    if (dateFrom) {
      const fromIso = new Date(`${dateFrom}T00:00:00Z`);
      if (!Number.isNaN(fromIso.getTime())) {
        filterClauses.push("created_at >= ?");
        filterParams.push(fromIso.toISOString());
      }
    }
    const whereSql = filterClauses.join(" AND ");

    const logs = await db.all(
      `SELECT id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms,
              status, error_message, estimated_prefix_cache_savings,
              cache_read_input_tokens, cache_creation_input_tokens, kv_cache_measured,
              retry_count, cost_usd, created_at
         FROM ai_logs
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [...filterParams, limit, offset]
    );

    const totalLogCountRow = await db.get(`SELECT COUNT(*) as c FROM ai_logs WHERE ${whereSql}`, filterParams);

    // ---------------------------------------------------------------
    // 10. Server / system health (PRD §24-§26)
    // ---------------------------------------------------------------
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const uptimeSeconds = Math.round(process.uptime());
    // Provider availability is derived from the error rate in the current range.
    const providerHealthy = totalCalls === 0 ? true : errorRate < 20;
    const system = {
      uptimeSeconds,
      nodeVersion: process.version,
      memoryHeapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      memoryHeapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      memoryRssMB: Math.round(memory.rss / 1024 / 1024),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      apiHealthy: true,
      databaseHealthy: true,
      providerHealthy,
      // Restart monitoring (PRD §25). Restart count is not durable across
      // restarts, so it is intentionally null when unavailable.
      restart: {
        recentlyRestarted: uptimeSeconds < RESTART_THRESHOLD_SECONDS,
        uptimeSeconds,
        thresholdSeconds: RESTART_THRESHOLD_SECONDS,
        restartCount: null,
        message:
          uptimeSeconds < RESTART_THRESHOLD_SECONDS
            ? `Server recently restarted. Current uptime: ${formatDuration(uptimeSeconds)}.`
            : null,
      },
    };

    // ---------------------------------------------------------------
    // 11. Semantic telemetry type classification (PRD §4, §36, §41)
    // ---------------------------------------------------------------
    const telemetryType = {
      calls: "actual",
      errorRate: "actual",
      retryRate: "actual",
      latency: "actual",
      percentiles: "derived",
      tailLatency: "derived",
      tokens: "actual",
      cost: "estimated",
      prefixReuse: "estimated",
      kvCache: "actual",
      providerComparison: "derived",
      system: "actual",
      restart: "derived",
    };

    // ---------------------------------------------------------------
    // 12. Prefix optimization semantics (PRD §16-§19)
    // ---------------------------------------------------------------
    const estimatedPrefixReusePct =
      eligiblePromptTokens > 0 ? Math.round((estimatedPrefixCacheSavings / eligiblePromptTokens) * 1000) / 10 : 0;
    const estimatedSavedCostUSD = formatUsd((estimatedPrefixCacheSavings * PROMPT_PRICE_PER_K) / 1000);

    const prefixOptimization = {
      // Estimated (application-level, NOT actual provider KV reuse).
      estimatedSavedTokens: estimatedPrefixCacheSavings,
      eligiblePromptTokens,
      estimatedPrefixReusePct,
      estimatedSavedCostUSD,
      // Actual provider KV-cache telemetry (only meaningful when available).
      actualCacheHits: kvCacheAvailable ? cacheReadInputTokens : null,
      actualCacheMisses: kvCacheAvailable ? cacheCreationInputTokens : null,
      kvCacheAvailable,
      kvCacheSource: kvCacheAvailable ? "provider" : "unavailable",
      // Never present "KV Cache Efficiency = X%" derived from estimates when
      // actual hits are zero/unavailable (PRD §17).
      statusNote: kvCacheAvailable
        ? "Actual provider KV-cache telemetry is available."
        : "Actual provider KV-cache telemetry unavailable. Current savings are application-level estimates.",
    };

    // ---------------------------------------------------------------
    // 13. Token analytics (PRD §12-§13)
    // ---------------------------------------------------------------
    const metrics = {
      totalCalls,
      callsToday,
      errorRate,
      errorCalls,
      retryRate,
      avgLatencyMs: statsQuery?.avg_latency ? Math.round(statsQuery.avg_latency) : null,
      p50LatencyMs: p50,
      p75LatencyMs: p75,
      p90LatencyMs: p90,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      promptTokens,
      completionTokens,
      totalTokens,
      promptTokenPct: totalTokens > 0 ? Math.round((promptTokens / totalTokens) * 1000) / 10 : 0,
      completionTokenPct: totalTokens > 0 ? Math.round((completionTokens / totalTokens) * 1000) / 10 : 0,
      avgTokensPerRequest: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
      avgPromptPerRequest: totalCalls > 0 ? Math.round(promptTokens / totalCalls) : 0,
      avgCompletionPerRequest: totalCalls > 0 ? Math.round(completionTokens / totalCalls) : 0,
      tokensPerApiCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
      tokensPerEvaluation: evaluationCalls > 0 ? Math.round(evaluationTokens / evaluationCalls) : null,
      // Cost (explicitly ESTIMATED, never presented as billing — PRD §14).
      estimatedCostUSD,
      costPerEvaluation: evaluationCalls > 0 ? formatUsd((statsQuery.total_cost_usd || 0) / evaluationCalls) : null,
      costPer1KTokens: totalTokens > 0 ? formatUsd(((statsQuery.total_cost_usd || 0) / totalTokens) * 1000) : null,
      cacheEfficiencyPercent: null, // removed: conflates estimate with actual KV telemetry
    };

    return sendJson(res, 200, {
      metrics,
      latencyDistribution,
      latencyByOperation,
      costByOperation,
      tailLatency,
      providerPerformance,
      slowestCalls,
      prefixOptimization,
      system,
      telemetryType,
      modelUsage: providerPerformance.map((p) => ({ model: p.model, calls: p.calls })),
      logs,
      logFilters: { operations: opRows.map((r) => r.action), models: providerRows.map((r) => r.model) },
      pagination: { limit, offset, total: totalLogCountRow?.c || 0 },
      range,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Observability API Error:", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}