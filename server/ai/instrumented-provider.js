/**
 * Provider decorator for AI telemetry.
 * Keeps the Assessment Harness provider contract intact while ensuring direct
 * provider consumers emit the same telemetry as gateway-based consumers.
 */
const { recordAiCall } = require("./telemetry");

function instrumentProvider(provider) {
  if (!provider || typeof provider.generate !== "function") {
    throw new TypeError("AI provider harus menyediakan generate(request)");
  }

  return {
    name: provider.name,
    version: provider.version,
    async generate(request = {}) {
      const startedAt = Date.now();
      try {
        const content = await provider.generate(request);
        await recordAiCall({
          tenantId: request.tenantId,
          userId: request.userId,
          runId: request.runId,
          action: request.action || "harness-evaluation",
          model: provider.name || request.model || "unknown",
          latencyMs: Date.now() - startedAt,
          status: "success",
        });
        return content;
      } catch (error) {
        await recordAiCall({
          tenantId: request.tenantId,
          userId: request.userId,
          runId: request.runId,
          action: request.action || "harness-evaluation",
          model: request.model || provider.name || "unknown",
          latencyMs: Date.now() - startedAt,
          status: "error",
          errorMessage: error.message,
        });
        throw error;
      }
    },
  };
}

module.exports = { instrumentProvider };
