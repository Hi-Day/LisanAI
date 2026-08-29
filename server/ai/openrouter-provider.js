const { AIProvider } = require("./provider");
const { callOpenRouter, streamOpenRouter } = require("../openrouter");

/**
 * OpenRouter provider adapter — hides provider details from the harness.
 */
class OpenRouterProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.name = "openrouter";
    this.version = "1.0.0";
    this.options = options;
  }

  async generate(request) {
    let messages = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.userMessage || request.prompt });

    const context = {
      tenantId: request.tenantId,
      userId: request.userId,
      action: "evaluate-harness",
      runId: request.runId,
      gen: {
        temperature: request.temperature,
        topP: request.topP,
        maxTokens: request.maxTokens,
      },
    };

    // Streaming: when the harness forwards an onToken callback (via a wrapped
    // provider), stream the raw LLM output token-by-token so the UI can render
    // the evaluation JSON incrementally instead of waiting for completion.
    if (typeof request.onToken === "function") {
      const { content } = await streamOpenRouter(
        messages,
        request.schemaHint || "Balas JSON valid.",
        context,
        (delta) => request.onToken(delta)
      );
      return content;
    }

    const result = await callOpenRouter(messages, request.schemaHint || "Balas JSON valid.", context);
    return JSON.stringify(result);
  }
}

module.exports = { OpenRouterProvider };