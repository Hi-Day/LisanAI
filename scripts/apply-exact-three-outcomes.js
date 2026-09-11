const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "server", "assessment-service.js");
let source = fs.readFileSync(FILE, "utf8");

source = source.replace(
  'const RECOMMEND_CONFIG_SCHEMA =\n  \'Format: {"outcomes":"3-5 learning outcome dalam baris terpisah"}\';',
  'const RECOMMEND_CONFIG_SCHEMA =\n  \'Format: {"outcomes":"TEPAT 3 learning outcome dalam 3 baris terpisah"}. Jangan menghasilkan 2 atau 4+ outcome.\';'
);

const oldPrompt = 'tugas: "Buat rekomendasi capaian pembelajaran (learning outcome) untuk assessment lisan.",';
const newPrompt = 'tugas: "Buat TEPAT 3 capaian pembelajaran (learning outcome) untuk assessment lisan. Harus tepat tiga item, satu item per baris, tidak boleh 2 dan tidak boleh 4 atau lebih.",';
if (source.includes(oldPrompt)) source = source.replace(oldPrompt, newPrompt);

const oldRules = 'aturan: [\n          "Gunakan kata kerja operasional yang dapat diamati.",';
const newRules = 'aturan: [\n          "Hasil WAJIB tepat 3 learning outcome yang berbeda dan tidak duplikatif.",\n          "Gunakan kata kerja operasional yang dapat diamati.",';
if (source.includes(oldRules)) source = source.replace(oldRules, newRules);

fs.writeFileSync(FILE, source, "utf8");
console.log("Applied exact-three learning outcome backend guard.");
