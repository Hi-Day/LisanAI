const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");

const SERVICE_FILE = path.join(ROOT, "server", "assessment-service.js");
let service = fs.readFileSync(SERVICE_FILE, "utf8");

const marker = '        learning_outcome: payload.outcomes,\n        rubrik: payload.rubric,';
const replacement = '        learning_outcome: payload.outcomes,\n        coverage_target: payload.coverageTarget || "",\n        coverage_target_type: payload.coverageTargetType || "",\n        rubrik: payload.rubric,';
if (!service.includes(replacement)) {
  if (!service.includes(marker)) throw new Error("Assessment generation message marker not found.");
  service = service.replace(marker, replacement);
}

const rulesMarker = '          "Soal tidak boleh menanyakan hal yang tidak diukur oleh kriteria mana pun.",';
const rulesReplacement = '          "Soal tidak boleh menanyakan hal yang tidak diukur oleh kriteria mana pun.",\n          ...(payload.coverageTarget ? [`Jika ada coverage_target, soal ini WAJIB secara eksplisit mengukur target tersebut. coverage_target_type=${payload.coverageTargetType || "outcome"}; target=${payload.coverageTarget}. Jangan mengganti target dengan kriteria atau capaian lain.`] : []),';
if (!service.includes(rulesReplacement)) {
  if (!service.includes(rulesMarker)) throw new Error("Assessment generation rules marker not found.");
  service = service.replace(rulesMarker, rulesReplacement);
}
fs.writeFileSync(SERVICE_FILE, service, "utf8");

const API_FILE = path.join(ROOT, "api", "assessment.js");
let api = fs.readFileSync(API_FILE, "utf8");
const apiMarker = '    if (action === "generate-questions") return sendJson(res, 200, { questions: await generateQuestions(payload), model: process.env.OPENROUTER_MODEL });';
const apiReplacement = '    if (action === "generate-question-for-uncovered-criterion") {\n      const target = String(payload.coverageTarget || payload.criterion || "").trim();\n      if (!target) return sendJson(res, 400, { error: "Coverage target wajib diisi" });\n      const questions = await generateQuestions({ ...payload, count: 1, coverageTarget: target, coverageTargetType: payload.coverageTargetType || (payload.criterion ? "criterion" : "outcome") });\n      const question = Array.isArray(questions) ? questions[0] : null;\n      if (!question) return sendJson(res, 502, { error: "AI tidak menghasilkan soal tambahan" });\n      return sendJson(res, 200, { question, model: process.env.OPENROUTER_MODEL });\n    }\n    if (action === "generate-questions") return sendJson(res, 200, { questions: await generateQuestions(payload), model: process.env.OPENROUTER_MODEL });';
if (!api.includes('generate-question-for-uncovered-criterion')) {
  if (!api.includes(apiMarker)) throw new Error("Assessment API generation marker not found.");
  api = api.replace(apiMarker, apiReplacement);
}
fs.writeFileSync(API_FILE, api, "utf8");

execFileSync(process.execPath, [path.join(__dirname, "apply-canonical-terminology.js")], { cwd: ROOT, env: process.env, stdio: "inherit" });
console.log("Applied coverage-target question generation backend.");
