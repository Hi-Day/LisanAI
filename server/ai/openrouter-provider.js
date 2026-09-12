const { AIProvider } = require("./provider");
const { MockProvider } = require("./mock-provider");
const { requestModel, streamModel } = require("./openrouter-client");

class OpenRouterProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.name = "openrouter";
    this.version = "1.1.0";
    this.options = options;
  }

  hasApiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    return Boolean(key && key !== "mock-key" && !key.includes("your_api_key"));
  }

  async generate(request) {
    if (!this.hasApiKey()) return new MockProvider().generate(request);

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
        if (typeof request.onToken === "function") {
          const result = await streamModel(model, messages, request.schemaHint || "Balas JSON valid.", gen, request.onToken);
          return result.content;
        }
        const result = await requestModel(model, messages, request.schemaHint || "Balas JSON valid.", gen);
        return result.content;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("OpenRouter request gagal");
  }
}

module.exports = { OpenRouterProvider };
