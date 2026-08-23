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
    const content = request.prompt;
    const result = await callOpenRouter(
      [{ role: "user", content }],
      request.schemaHint || "Balas JSON valid.",
      {
        tenantId: request.tenantId,
        userId: request.userId,
        action: "evaluate-harness",
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