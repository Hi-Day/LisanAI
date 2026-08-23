/**
 * AIProvider abstraction — LisanAI assessment harness must not know provider
 * details. Implementations: { async generate(request), name, version }.
 */
class AIProvider {
  /**
   * Generate. Request: { prompt, model, tenantId, userId, runId,
   *                      temperature, topP, maxTokens }.
   * @returns {Promise<string>} raw content string.
   */
  async generate() {
    throw new Error("generate() belum diimplementasikan");
  }
}

module.exports = { AIProvider };