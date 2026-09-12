const { AIProvider } = require("./provider");
const { MockProvider } = require("./mock-provider");
const { requestModel, streamModel } = require("./openrouter-client");

class OpenRouterProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.name = "openrouter";
    this.version = "1.2.0";
    this.options = options;
  }

  hasApiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    return Boolean(key && key !== "mock-key" && !key.includes("your_api_key"));
  }

  async generate(request) {
    const result = await this.generateWithMetadata(request);
    return result.content;
  }

  async generateWithMetadata(request) {
    if (!this.hasApiKey()) {
      return {
        content: await new MockProvider().generate(request),
        model: request.model || "mock",
        promptTokens: 0,
        completionTokens: 0,
        retries: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        kvCacheMeasured: false,
      };
    }

    const messages = [];
    if (request.systemPrompt) messages.push({ role: "system", content: request.systemPrompt });
    messages.push({ role: "user", content: request.userMessage || request.prompt || "" });

    const primaryModel = request.model || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
    const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
    const models = [primaryModel, fallbackModel].filter((value, index, array) => array.indexOf(value) === index);
    const gen = { temperature: request.temperature, topP: request.topP, maxTokens: request.maxTokens };

    let lastError = null;
    for (const model of models) {
      try {
        const result = typeof request.onToken === "function"
          ? await streamModel(model, messages, request.schemaHint || "Balas JSON valid.", gen, request.onToken)
          : await requestModel(model, messages, request.schemaHint || "Balas JSON valid.", gen);
        return {
          content: result.content,
          model,
          promptTokens: result.promptTokens || 0,
          completionTokens: result.completionTokens || 0,
          retries: result.retries || 0,
          cacheReadInputTokens: result.cacheReadInputTokens || 0,
          cacheCreationInputTokens: result.cacheCreationInputTokens || 0,
          kvCacheMeasured: result.cacheReadMeasured === true,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("OpenRouter request gagal");
  }
}

module.exports = { OpenRouterProvider };
