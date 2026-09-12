const { OPENROUTER_URL } = require("../config");

const REQUEST_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 60_000);
const MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES || 2);
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://127.0.0.1:4173",
    "X-Title": "Lisan.ai",
  };
}

function buildMessages(messages, schemaHint) {
  return [
    {
      role: "system",
      content:
        "Anda adalah evaluator pendidikan berbahasa Indonesia. Balas hanya JSON valid tanpa markdown. " +
        (schemaHint || ""),
    },
    ...(Array.isArray(messages) ? messages : []),
  ];
}

async function requestModel(model, messages, schemaHint, gen = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(OPENROUTER_URL, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          model,
          temperature: gen.temperature ?? 0.25,
          top_p: gen.topP ?? 1,
          max_tokens: gen.maxTokens ?? 4000,
          reasoning: { effort: "none", exclude: true },
          messages: buildMessages(messages, schemaHint),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error?.message || `OpenRouter error ${response.status}`);
        if (!isRetryableStatus(response.status)) error.retryable = false;
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = error;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
        throw error;
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Respons model kosong");

      return {
        content,
        data,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        cacheReadInputTokens: resolveCachedInputTokens(data.usage),
        retries: attempt,
      };
    } catch (error) {
      if (error.retryable !== false && attempt < MAX_RETRIES) {
        lastError = error;
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("OpenRouter request gagal");
}

async function streamModel(model, messages, schemaHint, gen = {}, onChunk) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(OPENROUTER_URL, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          model,
          temperature: gen.temperature ?? 0.25,
          top_p: gen.topP ?? 1,
          max_tokens: gen.maxTokens ?? 4000,
          stream: true,
          reasoning: { effort: "none", exclude: true },
          messages: buildMessages(messages, schemaHint),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error?.message || `OpenRouter error ${response.status}`);
        if (!isRetryableStatus(response.status)) error.retryable = false;
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = error;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
        throw error;
      }

      const result = await consumeStream(response, onChunk);
      return { ...result, retries: attempt };
    } catch (error) {
      if (error.retryable !== false && attempt < MAX_RETRIES) {
        lastError = error;
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("OpenRouter request gagal");
}

async function consumeStream(response, onChunk) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const data = await response.json().catch(() => ({}));
    const content = data.choices?.[0]?.message?.content || "";
    if (content && typeof onChunk === "function") onChunk(content);
    const cached = resolveCachedInputTokens(data.usage);
    return {
      content,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      cacheReadInputTokens: cached,
      cacheCreationInputTokens: Math.max(0, (data.usage?.prompt_tokens || 0) - cached),
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let cacheReadInputTokens = 0;
  let cacheCreationInputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const dataLine of dataLines) {
        if (dataLine === "[DONE]") continue;
        let parsed;
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }

        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          content += delta;
          if (typeof onChunk === "function") onChunk(delta);
        }

        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens || 0;
          completionTokens = parsed.usage.completion_tokens || 0;
          cacheReadInputTokens = resolveCachedInputTokens(parsed.usage);
          cacheCreationInputTokens = Math.max(0, promptTokens - cacheReadInputTokens);
        }
      }
    }
  }

  return { content, promptTokens, completionTokens, cacheReadInputTokens, cacheCreationInputTokens };
}

function resolveCachedInputTokens(usage) {
  if (!usage) return 0;
  const nativeCached = usage.native_tokens_cached;
  if (typeof nativeCached === "number" && Number.isFinite(nativeCached) && nativeCached > 0) return nativeCached;
  const cached = Number(usage.prompt_tokens_details?.cached_tokens);
  return Number.isFinite(cached) && cached > 0 ? cached : 0;
}

module.exports = {
  requestModel,
  streamModel,
  resolveCachedInputTokens,
  fetchWithTimeout,
  isRetryableStatus,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
};