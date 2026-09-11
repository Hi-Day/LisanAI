const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function replaceOnce(file, find, replace, label) {
  const filePath = path.join(ROOT, file);
  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes(replace)) {
    console.log(`Pedagogical grounding already applied: ${label}`);
    return false;
  }
  if (!source.includes(find)) {
    throw new Error(`Pedagogical grounding patch target not found: ${file} :: ${label}`);
  }
  fs.writeFileSync(filePath, source.replace(find, replace), "utf8");
  console.log(`Applied pedagogical grounding patch: ${label}`);
  return true;
}

function apply() {
  replaceOnce(
    "server/harness/alignment.js",
    'const learningOutcomeAlignment = require("./learning-outcome-alignment");',
    'const learningOutcomeAlignment = require("./learning-outcome-alignment");\nconst { groundQuestionsAgainstRubric } = require("./question-grounding");',
    "alignment import"
  );

  replaceOnce(
    "server/harness/alignment.js",
    "  return enforceLearningOutcomeAlignment(finalized, payload);",
    "  return enforceLearningOutcomeAlignment(groundQuestionsAgainstRubric(finalized, payload), payload);",
    "alignment grounding gate"
  );

  replaceOnce(
    "server/assessment-service.js",
    '          "Seluruh kriteria dalam daftar kriteria_rubrik_yang_tersedia wajib muncul di setidaknya satu soal.",',
    '          "Setiap criterion hanya boleh muncul pada soal jika pertanyaan tersebut secara eksplisit meminta evidence yang diperlukan criterion itu. Jangan memaksakan criterion hanya demi coverage; jika tidak grounded, jangan mapping-kan ke soal.",',
    "generation criterion grounding rule"
  );

  replaceOnce(
    "server/assessment-service.js",
    '        aturan_rubrik_per_soal: "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan yang dibuat dan learning_outcome. Rubrik harus berisi 3-4 indikator yang dapat diamati, lengkap dengan bobot total 100%, dan hanya menilai isi yang benar-benar diminta oleh pertanyaan serta selaras dengan learning outcome.",',
    '        aturan_rubrik_per_soal: "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan dan learning_outcome. Setiap criterion harus memiliki evidence demand yang eksplisit di pertanyaan. Jangan menambahkan indikator contoh, penerapan, alasan, analisis, perbandingan, atau evaluasi jika pertanyaan tidak memintanya. Jika criterion tidak dapat dibuktikan dari jawaban atas pertanyaan, jangan mapping-kan criterion tersebut.",',
    "generation rubric evidence rule"
  );

  replaceOnce(
    "src/js/assessment-wizard.js",
    "  _wizardCtx = ctx;\n  const { els } = ctx;",
    "  _wizardCtx = ctx;\n  window.__lisanAssessmentWizardBridge = {\n    get ctx() { return _wizardCtx; },\n    sync() { if (_wizardCtx) syncQuestionsFromEditor(_wizardCtx); },\n    render() { if (_wizardCtx) renderQuestionEditor(_wizardCtx); },\n  };\n  const { els } = ctx;",
    "wizard repair bridge"
  );
}

apply();
