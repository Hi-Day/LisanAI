const assert = require("node:assert/strict");
const test = require("node:test");

const { OpenRouterProvider } = require("../server/ai/openrouter-provider");

let originalApiKey;
let originalFetch;

test.beforeEach(() => {
  originalApiKey = process.env.OPENROUTER_API_KEY;
  originalFetch = global.fetch;
  delete process.env.OPENROUTER_API_KEY;
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalApiKey;
  }
});

test("generateWithMetadata throws when OPENROUTER_API_KEY is missing", async () => {
  await assert.rejects(
    () => new OpenRouterProvider().generateWithMetadata({ prompt: "x" }),
    /OPENROUTER_API_KEY/
  );
});

test("generateWithMetadata throws for a placeholder API key", async () => {
  process.env.OPENROUTER_API_KEY = "your_api_key_here";
  await assert.rejects(
    () => new OpenRouterProvider().generateWithMetadata({ prompt: "x" }),
    /OPENROUTER_API_KEY/
  );
});

test("generateWithMetadata throws for the mock-key sentinel", async () => {
  process.env.OPENROUTER_API_KEY = "mock-key";
  await assert.rejects(
    () => new OpenRouterProvider().generateWithMetadata({ prompt: "x" }),
    /OPENROUTER_API_KEY/
  );
});

test("with a real key the provider attempts a network call instead of returning mock content", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  global.fetch = async () => { throw new Error("network down"); };

  const provider = new OpenRouterProvider();
  assert.equal(provider.hasApiKey(), true);

  let caught;
  try {
    await provider.generateWithMetadata({ prompt: "x" });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught, "generateWithMetadata must reject when the network fails");
  assert.doesNotMatch(String(caught.message), /OPENROUTER_API_KEY/);
});
