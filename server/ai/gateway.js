/** Application-facing AI gateway. Provider and telemetry details stay behind this seam. */
const { OpenRouterProvider } = require("./openrouter-provider");
const { MockProvider } = require("./mock-provider");
const { recordAiCall } = require("./telemetry");

let provider;

function getProvider() {
  if (provider) return provider;
  const requested = String(process.env.AI_PROVIDER || "openrouter").toLowerCase();
  provider = requested === "mock" ? new MockProvider() : new OpenRouterProvider();
  return provider;
}

function normalizeRequest(messages, schemaHint, context = {}, onToken) {
  const list = Array.isArray(messages) ? messages : [];
  const systemPrompt = list.filter((m) => m?.role === "system").map((m) => m.content).join("\n");
  const userMessage = list.filter((m) => m?.role !== "system").map((m) => m.content).join("\n");
  return { ...context, prompt: userMessage, userMessage, systemPrompt, schemaHint, onToken };
}

async function invoke(request) {
  const startedAt = Date.now();
  try {
    const activeProvider = getProvider();
    const result = typeof activeProvider.generateWithMetadata === "function"
      ? await activeProvider.generateWithMetadata(request)
      : { content: await activeProvider.generate(request), model: activeProvider.name || "unknown" };

    await recordAiCall({
      tenantId: request.tenantId,
      userId: request.userId,
      runId: request.runId,
      action: request.action,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: Date.now() - startedAt,
      retryCount: result.retries,
      cacheReadInputTokens: result.cacheReadInputTokens,
      cacheCreationInputTokens: result.cacheCreationInputTokens,
      kvCacheMeasured: result.kvCacheMeasured,
    });
    return result.content;
  } catch (error) {
    await recordAiCall({
      tenantId: request.tenantId,
      userId: request.userId,
      runId: request.runId,
      action: request.action,
      model: request.model || process.env.OPENROUTER_MODEL || getProvider().name || "unknown",
      latencyMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}

async function generate(request) {
  return invoke(request);
}

async function call(messages, schemaHint, context = {}) {
  const content = await generate(normalizeRequest(messages, schemaHint, context));
  return typeof content === "string" ? JSON.parse(content) : content;
}

async function stream(messages, schemaHint, context, onChunk) {
  const content = await generate(normalizeRequest(messages, schemaHint, context, onChunk));
  return { content, parsed: typeof content === "string" ? JSON.parse(content) : content };
}

function resetProvider() {
  provider = null;
}

module.exports = { generate, call, stream, getProvider, resetProvider };
