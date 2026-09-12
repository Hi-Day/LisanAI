const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "server", "assessment-service.js");
let source = fs.readFileSync(FILE, "utf8");

const oldSchema = 'const RECOMMEND_CONFIG_SCHEMA = \'Format: {"outcomes":"3-5 learning outcome dalam baris terpisah"}\';';
const newSchema = 'const RECOMMEND_CONFIG_SCHEMA = \'Format: {"outcomes":"TEPAT 3 learning outcome dalam 3 baris terpisah"}. Jangan menghasilkan 2 atau 4+ outcome.\';';
if (source.includes(oldSchema)) {
  source = source.replace(oldSchema, newSchema);
} else if (!source.includes(newSchema)) {
  throw new Error("Exact-three outcome schema target not found.");
}

const oldPrompt = 'tugas: "Buat rekomendasi capaian pembelajaran (learning outcome) untuk assessment lisan.",';
const newPrompt = 'tugas: "Buat TEPAT 3 capaian pembelajaran (learning outcome) untuk assessment lisan. Harus tepat tiga item, satu item per baris, tidak boleh 2 dan tidak boleh 4 atau lebih.",';
if (source.includes(oldPrompt)) {
  source = source.replace(oldPrompt, newPrompt);
} else if (!source.includes(newPrompt)) {
  throw new Error("Exact-three outcome prompt target not found.");
}

fs.writeFileSync(FILE, source, "utf8");
console.log("Applied exact-three learning outcome backend guard.");
