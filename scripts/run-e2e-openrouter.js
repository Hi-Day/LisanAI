const { spawnSync } = require("node:child_process");

if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === "mock-key" || process.env.OPENROUTER_API_KEY.includes("your_api_key")) {
  console.error("OPENROUTER_API_KEY is required for the real OpenRouter E2E test.");
  console.error("Set OPENROUTER_API_KEY in the environment, then run: npm run test:e2e:openrouter");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  HARNESS_PROVIDER: "openrouter",
};

function run(args) {
  const result = spawnSync(npmCommand, args, {
    stdio: "inherit",
    env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  if (process.exitCode !== 0) process.exit(process.exitCode);
}

run(["run", "build:frontend"]);
run(["exec", "playwright", "test", "e2e/openrouter-evaluation.spec.js"]);
