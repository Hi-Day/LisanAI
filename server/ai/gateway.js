/** Application-facing AI gateway. Concrete provider details stay behind this seam. */
const { OpenRouterProvider } = require("./openrouter-provider");
const { MockProvider } = require("./mock-provider");
let provider;
function getProvider() {
  if (provider) return provider;
  const requested = String(process.env.AI_PROVIDER || "openrouter").toLowerCase();
  provider = requested === "mock" ? new MockProvider() : new OpenRouterProvider();
  return provider;
}
async function generate(request) { return getProvider().generate(request); }
async function call(messages, schemaHint, context = {}) {
  const content = await generate({ ...context, messages, schemaHint });
  return typeof content === "string" ? JSON.parse(content) : content;
}
async function stream(messages, schemaHint, context, onChunk) {
  const content = await generate({ ...context, messages, schemaHint, onToken: onChunk });
  return { content, parsed: JSON.parse(content) };
}
function resetProvider() { provider = null; }
module.exports = { generate, call, stream, getProvider, resetProvider };
