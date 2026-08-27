/**
 * Dynamic OpenRouter pricing.
 *
 * Fetches live per-token model prices from OpenRouter's public `/models`
 * endpoint, caches them in-memory, and exposes synchronous lookup for the
 * cost-estimation call sites (server/openrouter.js, api/observability.js).
 *
 * All cost figures derived here remain ESTIMATES for observability — they are
 * never presented as provider billing (PRD §14).
 *
 * Design constraints:
 *  - The catalog is fetched ONLY via the explicit `refreshCatalog()` call,
 *    which is invoked at server startup. The hot path never performs I/O.
 *  - This keeps cost lookup synchronous and lets the existing unit tests
 *    (which mock `global.fetch` and assert on retry/attempt counting) run
 *    without an accidental background network call interfering.
 *  - When the catalog is unavailable or the model is unknown, we fall back to
 *    env-configurable per-1K defaults instead of failing the call.
 */

const https = require("node:https");

const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const CATALOG_TIMEOUT_MS = Number(process.env.OPENROUTER_PRICE_CATALOG_TIMEOUT_MS || 8000);

// Fallback per-1K pricing (USD). Used only when the live catalog is empty or
// the requested model is not listed. Matches the app's configured default
// model (google/gemini-2.5-flash). Override via env when using another model.
const FALLBACK_PROMPT_PER_1K = Number(process.env.OPENROUTER_PROMPT_PRICE_PER_1K || 0.0003);
const FALLBACK_COMPLETION_PER_1K = Number(process.env.OPENROUTER_COMPLETION_PRICE_PER_1K || 0.0025);

// In-memory cache: { promptPerToken, completionPerToken } per model id.
let cache = null;
let lastError = null;

/**
 * Fetch the OpenRouter model catalog once and rebuild the price cache.
 * Silent on failure so a stale/absent catalog never breaks a request.
 * @returns {Promise<boolean>} true when the catalog was refreshed.
 */
async function refreshCatalog() {
  try {
    const body = await httpsGetJson(CATALOG_URL, CATALOG_TIMEOUT_MS);
    const data = body && Array.isArray(body.data) ? body.data : [];
    const next = new Map();
    for (const model of data) {
      if (!model || typeof model.id !== "string" || !model.pricing) continue;
      const p = model.pricing;
      next.set(model.id, {
        promptPerToken: parsePrice(p.prompt),
        completionPerToken: parsePrice(p.completion),
      });
    }
    if (next.size > 0) {
      cache = next;
      lastError = null;
      return true;
    }
    lastError = "Catalog kosong.";
  } catch (err) {
    lastError = err.message || String(err);
  }
  return false;
}

function parsePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Per-token pricing for a model, or null when unknown/not cached.
 * @returns {{promptPerToken:number, completionPerToken:number}|null}
 */
function getModelPricing(model) {
  if (!model || !cache) return null;
  return cache.get(model) || null;
}

/**
 * Estimate cost (USD) for a token usage, using cached live prices when known,
 * otherwise the env-overridable fallback constants. Synchronous and I/O-free.
 */
function estimateCostUsd(promptTokens, completionTokens, model) {
  const pricing = getModelPricing(model);
  if (pricing) {
    return promptTokens * pricing.promptPerToken + completionTokens * pricing.completionPerToken;
  }
  return (promptTokens * FALLBACK_PROMPT_PER_1K + completionTokens * FALLBACK_COMPLETION_PER_1K) / 1000;
}

/**
 * Effective prompt price per 1K tokens for a model (for prefix-savings
 * estimates), falling back to the default constant when unknown.
 */
function getPromptPricePer1k(model) {
  const pricing = getModelPricing(model);
  return pricing ? pricing.promptPerToken * 1000 : FALLBACK_PROMPT_PER_1K;
}

function getCacheStatus() {
  return {
    loaded: !!cache,
    models: cache ? cache.size : 0,
    lastError,
  };
}

/**
 * Minimal HTTPS GET helper that returns parsed JSON. Bypasses any mocked
 * `global.fetch` so the catalog fetch never disturbs request-path retry logic
 * under test, and it works regardless of Node global-fetch availability.
 * @returns {Promise<object>}
 */
function httpsGetJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: "application/json" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

module.exports = {
  refreshCatalog,
  getModelPricing,
  estimateCostUsd,
  getPromptPricePer1k,
  getCacheStatus,
};