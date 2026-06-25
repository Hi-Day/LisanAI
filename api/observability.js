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
        AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as avg_latency,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(cache_savings_tokens) as total_cache_savings_tokens
       FROM ai_logs 
       WHERE tenant_id = ?`,
      tenantId
    );

    const totalCalls = statsQuery?.total_calls || 0;
    const errorCalls = statsQuery?.error_calls || 0;
    const errorRate = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 100) : 0;
    const avgLatency = statsQuery?.avg_latency ? Math.round(statsQuery.avg_latency) : 0;
    const promptTokens = statsQuery?.total_prompt_tokens || 0;
    const completionTokens = statsQuery?.total_completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const cacheSavingsTokens = statsQuery?.total_cache_savings_tokens || 0;

    // Pricing estimation (based on standard models like GPT-4o-mini / Claude 3.5 Sonnet on OpenRouter)
    // Prompt tokens: $0.15 per 1M tokens ($0.00015 / 1K tokens)
    // Completion tokens: $0.60 per 1M tokens ($0.00060 / 1K tokens)
    // Adjust values to be realistic and legible
    const PROMPT_PRICE_PER_K = 0.0015; // $0.0015 per 1K
    const COMPLETION_PRICE_PER_K = 0.0020; // $0.0020 per 1K

    const actualCost = (promptTokens * PROMPT_PRICE_PER_K / 1000) + (completionTokens * COMPLETION_PRICE_PER_K / 1000);
    const savedCost = cacheSavingsTokens * PROMPT_PRICE_PER_K / 1000;
    const originalCost = actualCost + savedCost;

    const cacheEfficiency = originalCost > 0 ? Math.round((savedCost / originalCost) * 100) : 0;

    // 2. Fetch recent logs (limit 50)
    const logs = await db.all(
      `SELECT id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error_message, cache_savings_tokens, created_at
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
        avgLatencyMs: avgLatency,
        promptTokens,
        completionTokens,
        totalTokens,
        cacheSavingsTokens,
        actualCostUSD: parseFloat(actualCost.toFixed(5)),
        savedCostUSD: parseFloat(savedCost.toFixed(5)),
        cacheEfficiencyPercent: cacheEfficiency,
      },
      system: systemStats,
      logs,
    });
  } catch (error) {
    console.error("Observability API Error:", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
