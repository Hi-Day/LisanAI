/**
 * Application-facing AI gateway.
 *
 * Application/domain code depends on this seam rather than a concrete model
 * provider. Provider selection stays inside infrastructure (server/ai).
 */
const { OpenRouterProvider } = require("./openrouter-provider");
const { MockProvider } = require("./mock-provider");

let provider;

function getProvider() {
  if (provider) return provider;
  const requested = String(process.env.AI_PROVIDER || "openrouter").toLowerCase();
  provider = requested === "mock" ? new MockProvider() : new OpenRouterProvider();
  return provider;
}

async function generate(request) {
  return getProvider().generate(request);
}

function resetProvider() {
  provider = null;
}

module.exports = { generate, getProvider, resetProvider };
