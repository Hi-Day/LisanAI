const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { build } = require("esbuild");

const ROOT = path.join(__dirname, "..");

function runProductionProvisioning() {
  if (process.env.VERCEL_ENV !== "production") return;

  const scripts = [
    "scripts/provision-pendopo-demo.js",
    "scripts/verify-pendopo-demo.js",
  ];

  for (const script of scripts) {
    console.log(`Running production database step: ${script}`);
    execFileSync(process.execPath, [path.join(ROOT, script)], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });
  }
}

async function main() {
  const result = await build({
    entryPoints: [path.join(ROOT, "src", "js", "app.js")],
    outfile: path.join(ROOT, "public", "js", "app.bundle.js"),
    bundle: true,
    minify: true,
    sourcemap: false,
    format: "esm",
    target: ["es2020"],
    logLevel: "info",
    banner: {
      js: `import("/js/learning-outcome-trend.js").catch(() => {});`,
    },
  });

  fs.copyFileSync(
    path.join(ROOT, "src", "js", "learning-outcome-trend.js"),
    path.join(ROOT, "public", "js", "learning-outcome-trend.js")
  );

  console.log("Frontend bundle built successfully.");
  runProductionProvisioning();
  return result;
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
