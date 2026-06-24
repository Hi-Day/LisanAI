const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const PORT = Number(process.env.PORT || 4173);
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

function loadEnv() {
  if (fs.existsSync(ENV_PATH)) {
    fs.readFileSync(ENV_PATH, "utf8")
      .split(/\r?\n/)
      .forEach((line) => {
        const match = line.match(/^([^#=\s]+)=(.*)$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
      });
  }

  process.env.OPENROUTER_MODEL ||= DEFAULT_MODEL;
  process.env.TURSO_DATABASE_URL ||= `file:${path.join(ROOT, "data", "lisan_ai.db")}`;
}

module.exports = {
  OPENROUTER_URL,
  PORT,
  ROOT,
  loadEnv,
};
