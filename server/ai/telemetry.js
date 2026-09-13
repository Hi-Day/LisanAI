/**
 * AI telemetry boundary.
 * Provider adapters report usage here; persistence stays outside transport code.
 */
const crypto = require("node:crypto");
const pricing = require("./pricing");
const { getDb } = require("../database");

async function estimatePrefixCacheSavings({ tenantId, action, promptTokens }) {
  if (!tenantId || !action || !Number.isFinite(promptTokens) || promptTokens <= 300) return 0;

  try {
    const db = getDb();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentCall = await db.get(
      "SELECT id FROM ai_logs WHERE tenant_id = ? AND action = ? AND status = 'success' AND created_at > ? LIMIT 1",
      tenantId,
      action,
      fifteenMinutesAgo
    );
    return recentCall ? Math.round(promptTokens * 0.65) : 0;
  } catch (error) {
    console.error("Gagal memeriksa status cache:", error);
    return 0;
  }
}

/**
 * Persist one AI invocation's operational telemetry.
 * This deliberately accepts provider-neutral usage data.
 */
async function recordAiCall({
  tenantId = "system",
  userId = "system",
  runId = null,
  action = "unknown",
  model = "unknown",
  promptTokens = 0,
  completionTokens = 0,
  latencyMs = 0,
  status = "success",
  errorMessage = null,
  retryCount = 0,
  cacheReadInputTokens = 0,
  cacheCreationInputTokens = 0,
  kvCacheMeasured = false,
}) {
  const totalTokens = Number(promptTokens || 0) + Number(completionTokens || 0);
  const estimatedPrefixCacheSavings = status === "success"
    ? await estimatePrefixCacheSavings({ tenantId, action, promptTokens: Number(promptTokens || 0) })
    : 0;
  const costUsd = pricing.estimateCostUsd(
    Number(promptTokens || 0),
    Number(completionTokens || 0),
    model
  );

  try {
    const db = getDb();
    await db.run(
      `INSERT INTO ai_logs (id, tenant_id, user_id, run_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error_message, estimated_prefix_cache_savings, cache_read_input_tokens, cache_creation_input_tokens, retry_count, cost_usd, kv_cache_measured, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID().replace(/-/g, ""),
      tenantId,
      userId,
      runId,
      action,
      model,
      Number(promptTokens || 0),
      Number(completionTokens || 0),
      totalTokens,
      Number(latencyMs || 0),
      status,
      errorMessage,
      estimatedPrefixCacheSavings,
      Number(cacheReadInputTokens || 0),
      Number(cacheCreationInputTokens || 0),
      Number(retryCount || 0),
      costUsd,
      kvCacheMeasured ? 1 : 0,
      new Date().toISOString()
    );
  } catch (error) {
    // Telemetry failure must never turn a successful AI request into an error.
    console.error("Gagal menyimpan log observabilitas:", error);
  }
}

module.exports = { estimatePrefixCacheSavings, recordAiCall };
