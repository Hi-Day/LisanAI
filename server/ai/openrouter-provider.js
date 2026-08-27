const { AIProvider } = require("./provider");
const { callOpenRouter } = require("../openrouter");

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
    // Prefer an explicit stable system block when the harness provided one.
    // Putting the reuseable instruction/rubric/schema in the system message
    // (first in the array) is what gives provider KV prefix caches a hit —
    // the volatile student answers stay confined to the last user message.
    let messages = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.userMessage || request.prompt });

    const result = await callOpenRouter(
      messages,
      request.schemaHint || "Balas JSON valid.",
      {
        tenantId: request.tenantId,
        userId: request.userId,
        action: "evaluate-harness",
        runId: request.runId,
        // Generation parameters (FR-16 / P0) forwarded to the provider.
        gen: {
          temperature: request.temperature,
          topP: request.topP,
          maxTokens: request.maxTokens,
        },
      }
    );
    // callOpenRouter returns the parsed data object; stringify raw for the parser.
    return JSON.stringify(result);
  }
}

module.exports = { OpenRouterProvider };