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
function normalizeRequest(messages, schemaHint, context = {}, onToken) {
  const list = Array.isArray(messages) ? messages : [];
  const systemPrompt = list.filter((m) => m?.role === "system").map((m) => m.content).join("\n");
  const userMessage = list.filter((m) => m?.role !== "system").map((m) => m.content).join("\n");
  return { ...context, prompt: userMessage, userMessage, systemPrompt, schemaHint, onToken };
}
async function generate(request) { return getProvider().generate(request); }
async function call(messages, schemaHint, context = {}) {
  const content = await generate(normalizeRequest(messages, schemaHint, context));
  return typeof content === "string" ? JSON.parse(content) : content;
}
async function stream(messages, schemaHint, context, onChunk) {
  const content = await generate(normalizeRequest(messages, schemaHint, context, onChunk));
  return { content, parsed: typeof content === "string" ? JSON.parse(content) : content };
}
function resetProvider() { provider = null; }
module.exports = { generate, call, stream, getProvider, resetProvider };
