const { OPENROUTER_URL } = require("./config");
const { getDb } = require("./database");
const crypto = require("node:crypto");

// Timeout for a single OpenRouter request (ms). Prevents hanging requests.
const REQUEST_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 60_000);
// Max retries for transient errors (429, 5xx, network) per model attempt.
const MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES || 2);
// Base delay for exponential backoff (ms).
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

/**
 * Fetch with a timeout using AbortController.
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Perform a single model request with retry + exponential backoff.
 * Returns { ok, status, data } or throws on non-retryable failure.
 */
async function requestModel(model, messages, schemaHint) {
  let lastError = null;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://127.0.0.1:4173",
            "X-Title": "Lisan.ai",
          },
          body: JSON.stringify({
            model,
            temperature: 0.25,
            max_tokens: 4000,
            reasoning: {
              effort: "none",
              exclude: true,
            },
            messages: [
              {
                role: "system",
                content:
                  "Anda adalah evaluator pendidikan berbahasa Indonesia. Balas hanya JSON valid tanpa markdown. " +
                  schemaHint,
              },
              ...messages,
            ],
          }),
        },
        REQUEST_TIMEOUT_MS
      );

      const data = await response.json().catch(() => ({}));

      // Non-OK responses: retry only transient errors (429, 5xx).
      if (!response.ok) {
        const err = new Error(data.error?.message || `OpenRouter error ${response.status}`);
        // Mark non-retryable HTTP errors so the catch block does not retry them.
        if (!isRetryableStatus(response.status)) err.retryable = false;
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = err;
          retries += 1;
          const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
          await sleep(delay);
          continue;
        }
        throw err;
      }

      return { ok: true, status: response.status, data, retries };
    } catch (err) {
      // Only retry transient/network errors (timeout, connection). Non-retryable
      // HTTP errors are thrown above and must NOT be retried here.
      if (err.retryable !== false && attempt < MAX_RETRIES) {
        lastError = err;
        retries += 1;
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("OpenRouter request gagal");
}

async function callOpenRouter(messages, schemaHint, context = {}) {
  const startTime = Date.now();
  const tenantId = context.tenantId || "system";
  const userId = context.userId || "system";
  const action = context.action || "unknown";
  const primaryModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
  let model = primaryModel;

  let promptTokens = 0;
  let completionTokens = 0;
  let responseData = null;
  let errorMsg = null;
  let status = "success";
  let content = null;
  let retryCount = 0;
  // Actual provider KV-cache metrics (from OpenRouter usage.prompt_tokens_details).
  let cacheReadInputTokens = 0;
  let cacheCreationInputTokens = 0;

  try {
    const hasApiKey = !!process.env.OPENROUTER_API_KEY && 
                      process.env.OPENROUTER_API_KEY !== "mock-key" && 
                      !process.env.OPENROUTER_API_KEY.includes("your_api_key");

    if (!hasApiKey) {
      // Simulate API latency delay
      const simulatedDelay = 800 + Math.floor(Math.random() * 1200);
      await new Promise(resolve => setTimeout(resolve, simulatedDelay));

      if (action === "generate-questions") {
        const payload = JSON.parse(messages[0].content);
        const count = payload.jumlah_soal || 5;
        const questions = [];
        for (let i = 1; i <= count; i++) {
          questions.push({
            prompt: `Bagaimana pemahaman Anda tentang ${payload.topik} pada aspek ${payload.learning_outcome ? 'kompetensi' : 'umum'} ke-${i}?`,
            focus: payload.topik,
            ideal: `Penjelasan yang komprehensif mengenai konsep ${payload.topik} sesuai rubrik evaluasi.`
          });
        }
        content = JSON.stringify({ questions });
      } else if (action === "recommend-assessment-config") {
        const payload = JSON.parse(messages[0].content);
        content = JSON.stringify({
          outcomes: `1. Siswa mampu memahami prinsip dasar dari ${payload.topic}.\n2. Siswa mampu menerapkan konsep ${payload.topic} dalam studi kasus lisan.\n3. Siswa dapat menyusun argumen lisan yang terstruktur.`,
          rubric: `Kelancaran Berbicara: 30%\nKesesuaian Materi & Konsep: 40%\nKetepatan Tata Bahasa & Diksi: 30%`
        });
      } else if (action === "evaluate") {
        const payload = JSON.parse(messages[0].content);
        const questionScores = (payload.qa_pairs || []).map((pair, idx) => {
          const score = 75 + Math.floor(Math.random() * 21); // 75 - 95
          return {
            question: pair.question,
            answer: pair.student_answer,
            score,
            matched: ["konsep utama", "diksi tepat"],
            strengths: ["Penyampaian lisan cukup lancar dan terstruktur", "Penggunaan kata kunci yang tepat"],
            gaps: score < 85 ? ["Argumen pendukung dapat diperdalam lagi dengan contoh konkret"] : []
          };
        });
        const finalScore = Math.round(questionScores.reduce((acc, q) => acc + q.score, 0) / questionScores.length);
        content = JSON.stringify({
          finalScore,
          feedback: `Evaluasi Lisan: Siswa menunjukkan pemahaman yang baik tentang ${payload.topik || 'materi'}. Struktur kalimat sudah bagus, hanya perlu sedikit penguatan pada kedalaman contoh.`,
          questionScores
        });
      } else if (action === "improve-questions") {
        const payload = JSON.parse(messages[0].content);
        const questions = (payload.questions || []).map((q, i) => ({
          prompt: `${q.prompt} (Disempurnakan oleh AI)`,
          focus: q.focus,
          ideal: q.ideal
        }));
        content = JSON.stringify({ questions });
      } else {
        content = JSON.stringify({});
      }

      promptTokens = 350 + Math.floor(Math.random() * 200);
      completionTokens = 180 + Math.floor(Math.random() * 150);
    } else {
      const candidateModels = [primaryModel, fallbackModel].filter((value, index, array) => array.indexOf(value) === index);
      let lastError = null;

      for (const candidateModel of candidateModels) {
        model = candidateModel;

        try {
          const result = await requestModel(candidateModel, messages, schemaHint);
          responseData = result.data;
          content = responseData.choices?.[0]?.message?.content;
          if (!content) throw new Error("Respons model kosong");

          promptTokens = responseData.usage?.prompt_tokens || 0;
          completionTokens = responseData.usage?.completion_tokens || 0;
          retryCount = result.retries || 0;
          // Actual provider KV-cache metrics (cache hit = read, cache miss = creation).
          const promptDetails = responseData.usage?.prompt_tokens_details || {};
          cacheReadInputTokens = promptDetails.cached_tokens || 0;
          cacheCreationInputTokens = Math.max(0, promptTokens - cacheReadInputTokens);
          break;
        } catch (err) {
          lastError = err;
          errorMsg = err.message;
          continue;
        }
      }

      if (!content) {
        throw lastError || new Error("OpenRouter request gagal");
      }
    }

    return parseJsonContent(content);
  } catch (err) {
    status = "error";
    errorMsg = err.message;
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    let estimatedPrefixCacheSavings = 0;

    // Estimate prefix KV-cache savings (NOT an actual provider metric).
    // If the call succeeds and has a significant system prompt/rubric (promptTokens > 300),
    // and there was another successful AI call by the same tenant in the last 15 minutes,
    // we estimate the prefix prompt is cached (saving ~65% of input tokens).
    if (status === "success" && promptTokens > 300) {
      try {
        const db = getDb();
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const recentCall = await db.get(
          "SELECT id FROM ai_logs WHERE tenant_id = ? AND action = ? AND status = 'success' AND created_at > ? LIMIT 1",
          tenantId,
          action,
          fifteenMinutesAgo
        );
        if (recentCall) {
          estimatedPrefixCacheSavings = Math.round(promptTokens * 0.65);
        }
      } catch (dbErr) {
        console.error("Gagal memeriksa status cache:", dbErr);
      }
    }

    // Estimate cost based on token usage (per-1K pricing).
    const PROMPT_PRICE_PER_K = 0.0015; // $ per 1K prompt tokens
    const COMPLETION_PRICE_PER_K = 0.0020; // $ per 1K completion tokens
    const costUsd = (promptTokens * PROMPT_PRICE_PER_K + completionTokens * COMPLETION_PRICE_PER_K) / 1000;

    // Save telemetry to the database asynchronously
    try {
      const db = getDb();
      await db.run(
        `INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error_message, estimated_prefix_cache_savings, cache_read_input_tokens, cache_creation_input_tokens, retry_count, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID().replace(/-/g, ""),
        tenantId,
        userId,
        action,
        model,
        promptTokens,
        completionTokens,
        promptTokens + completionTokens,
        latencyMs,
        status,
        errorMsg,
        estimatedPrefixCacheSavings,
        cacheReadInputTokens,
        cacheCreationInputTokens,
        retryCount,
        costUsd,
        new Date().toISOString()
      );
    } catch (dbErr) {
      console.error("Gagal menyimpan log observabilitas:", dbErr);
    }
  }
}

function parseJsonContent(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Respons model bukan JSON valid");
  }
}

module.exports = {
  callOpenRouter,
  fetchWithTimeout,
  isRetryableStatus,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
};
