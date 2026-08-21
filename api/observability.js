const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { getDb, initDatabase } = require("../server/database");
const { parseCookies, sendJson } = require("../server/http-utils");

let isDbInitialized = false;

module.exports = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }

    // Only allow GET requests
    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    // Authenticate user
    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    // Authorization: Admin only
    if (auth.user.role !== "admin") {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    const db = getDb();
    const tenantId = auth.tenant.id;

    // 1. Fetch AI logs aggregate statistics
    const statsQuery = await db.get(
      `SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_calls,
        SUM(retry_count) as total_retries,
        AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as avg_latency,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(estimated_prefix_cache_savings) as total_estimated_prefix_cache_savings,
        SUM(cache_read_input_tokens) as total_cache_read_input_tokens,
        SUM(cache_creation_input_tokens) as total_cache_creation_input_tokens
       FROM ai_logs 
       WHERE tenant_id = ?`,
      tenantId
    );

    const totalCalls = statsQuery?.total_calls || 0;
    const errorCalls = statsQuery?.error_calls || 0;
    const errorRate = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 100) : 0;
    const totalRetries = statsQuery?.total_retries || 0;
    const retryRate = totalCalls > 0 ? Math.round((totalRetries / totalCalls) * 100) : 0;
    const avgLatency = statsQuery?.avg_latency ? Math.round(statsQuery.avg_latency) : 0;
    const promptTokens = statsQuery?.total_prompt_tokens || 0;
    const completionTokens = statsQuery?.total_completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const estimatedPrefixCacheSavings = statsQuery?.total_estimated_prefix_cache_savings || 0;
    const cacheReadInputTokens = statsQuery?.total_cache_read_input_tokens || 0;
    const cacheCreationInputTokens = statsQuery?.total_cache_creation_input_tokens || 0;

    // 1b. Latency percentiles (p50 / p95 / p99) over successful calls.
    const latencyRows = await db.all(
      `SELECT latency_ms FROM ai_logs
       WHERE tenant_id = ? AND status = 'success' AND latency_ms IS NOT NULL
       ORDER BY latency_ms ASC`,
      tenantId
    );
    const latencies = latencyRows.map((row) => row.latency_ms);
    const percentile = (arr, p) => {
      if (!arr.length) return 0;
      const idx = Math.min(arr.length - 1, Math.ceil((p / 100) * arr.length) - 1);
      return Math.round(arr[Math.max(0, idx)]);
    };
    const p50Latency = percentile(latencies, 50);
    const p95Latency = percentile(latencies, 95);
    const p99Latency = percentile(latencies, 99);

    // 1c. Model usage breakdown (most-used models).
    const modelRows = await db.all(
      `SELECT model, COUNT(*) as calls
       FROM ai_logs
       WHERE tenant_id = ? AND model IS NOT NULL AND model != ''
       GROUP BY model
       ORDER BY calls DESC
       LIMIT 10`,
      tenantId
    );
    const modelUsage = modelRows.map((row) => ({ model: row.model, calls: row.calls }));

    // Pricing estimation (based on standard models like GPT-4o-mini / Claude 3.5 Sonnet on OpenRouter)
    // Prompt tokens: $0.15 per 1M tokens ($0.00015 / 1K tokens)
    // Completion tokens: $0.60 per 1M tokens ($0.00060 / 1K tokens)
    // Adjust values to be realistic and legible
    const PROMPT_PRICE_PER_K = 0.0015; // $0.0015 per 1K
    const COMPLETION_PRICE_PER_K = 0.0020; // $0.0020 per 1K

    const actualCost = (promptTokens * PROMPT_PRICE_PER_K / 1000) + (completionTokens * COMPLETION_PRICE_PER_K / 1000);
    const savedCost = estimatedPrefixCacheSavings * PROMPT_PRICE_PER_K / 1000;
    const originalCost = actualCost + savedCost;

    const cacheEfficiency = originalCost > 0 ? Math.round((savedCost / originalCost) * 100) : 0;

    // 2. Fetch recent logs (limit 50)
    const logs = await db.all(
      `SELECT id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error_message, estimated_prefix_cache_savings, cache_read_input_tokens, cache_creation_input_tokens, retry_count, cost_usd, created_at
       FROM ai_logs
       WHERE tenant_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 50`,
      tenantId
    );

    // 3. Gather server system status
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const systemStats = {
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memoryHeapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      memoryHeapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      memoryRssMB: Math.round(memory.rss / 1024 / 1024),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
    };

    return sendJson(res, 200, {
      metrics: {
        totalCalls,
        errorRate,
        retryRate,
        avgLatencyMs: avgLatency,
        p50LatencyMs: p50Latency,
        p95LatencyMs: p95Latency,
        p99LatencyMs: p99Latency,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedPrefixCacheSavings,
        cacheReadInputTokens,
        cacheCreationInputTokens,
        actualCostUSD: parseFloat(actualCost.toFixed(5)),
        savedCostUSD: parseFloat(savedCost.toFixed(5)),
        cacheEfficiencyPercent: cacheEfficiency,
      },
      modelUsage,
      system: systemStats,
      logs,
    });
  } catch (error) {
    console.error("Observability API Error:", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
