const { execFileSync } = require("node:child_process");

// Vercel creates preview builds for every push/PR. Only seed the shared
// showcase tenant from the production build so previews never mutate data.
if (process.env.VERCEL_ENV !== "production") {
  console.log(`Skipping showcase seed for VERCEL_ENV=${process.env.VERCEL_ENV || "unknown"}.`);
  process.exit(0);
}

console.log("Running production showcase demo provisioning...");
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "seed:showcase"], {
  stdio: "inherit",
});
