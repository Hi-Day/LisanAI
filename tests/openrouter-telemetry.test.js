const assert = require("node:assert/strict");
const test = require("node:test");

const { OpenRouterProvider } = require("../server/ai/openrouter-provider");

let originalFetch;
let originalApiKey;

test.beforeEach(() => {
  originalFetch = global.fetch;
  originalApiKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
});

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env.OPENROUTER_API_KEY = originalApiKey;
});

function mockResponse(usage) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage,
    }),
  };
}

test("OpenRouter telemetry does not mark cache as measured when usage omits cache fields", async () => {
  global.fetch = async () => mockResponse({ prompt_tokens: 100, completion_tokens: 20 });

  const result = await new OpenRouterProvider().generateWithMetadata({
    userMessage: "test",
    schemaHint: "JSON",
  });

  assert.equal(result.cacheReadInputTokens, 0);
  assert.equal(result.cacheCreationInputTokens, 0);
  assert.equal(result.kvCacheMeasured, false);
});

test("OpenRouter telemetry marks cache as measured when provider reports cached tokens", async () => {
  global.fetch = async () => mockResponse({
    prompt_tokens: 100,
    completion_tokens: 20,
    native_tokens_cached: 40,
  });

  const result = await new OpenRouterProvider().generateWithMetadata({
    userMessage: "test",
    schemaHint: "JSON",
  });

  assert.equal(result.cacheReadInputTokens, 40);
  assert.equal(result.kvCacheMeasured, true);
});
