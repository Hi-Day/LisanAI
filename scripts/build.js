const path = require("node:path");
const { build } = require("esbuild");

const ROOT = path.join(__dirname, "..");

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
  });

  console.log("Frontend bundle built successfully.");
  return result;
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
