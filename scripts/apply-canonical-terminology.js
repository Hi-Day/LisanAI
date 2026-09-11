const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const files = [
  path.join(ROOT, "public", "index.html"),
  path.join(ROOT, "src", "js", "assessment-wizard.js"),
];

for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  source = source.replace(/Kompetensi \/ capaian pembelajaran/g, "Capaian Pembelajaran");
  source = source.replace(/Learning outcome \(kompetensi yang diukur\)/g, "Capaian Pembelajaran (kompetensi yang diukur)");
  source = source.replace(/Learning outcome/g, "Capaian Pembelajaran");
  source = source.replace(/Rubrik yang diukur soal ini:/g, "Kriteria rubrik yang diukur soal ini:");
  fs.writeFileSync(file, source, "utf8");
}

console.log("Applied canonical terminology: Capaian Pembelajaran vs Kriteria Rubrik.");
