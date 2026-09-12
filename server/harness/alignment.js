const { call: callOpenRouter, stream: streamOpenRouter } = require("../ai/gateway");
const { parseJson } = require("../ai/response-parser");
const { parseRubricText } = require("./plugins/rubric");
const learningOutcomeAlignment = require("./learning-outcome-alignment");
const { groundQuestionsAgainstRubric } = require("./question-grounding");

// ---------------------------------------------------------------------------
// Soal ↔ Rubrik Alignment Harness
// ---------------------------------------------------------------------------
// Tugas: menjaga agar setiap soal hanya dinilai terhadap kriteria rubrik yang
// BENAR-BENAR diukur oleh substansi soal tersebut. Kalibrasi dilakukan via AI
// (menentukan subset kriteria per soal, dan bila perlu menulis ulang substansi
// soal agar selaras rubrik), lalu selalu ditutup oleh enforcement deterministik
// sehingga penilaian tidak "under-estimate": soal "sebutkan" tidak dihukum oleh
// kriteria yang butuh analisis/sebab-akibat/penerapan yang tidak pernah diminta.

/** Parse rubric teacher menjadi daftar kriteria terstruktur. */
function parseRubricCriteria(payload) {
  const rubric = payload && payload.rubric;
  if (rubric && Array.isArray(rubric.criteria)) {
    return rubric.criteria.map((c, i) => ({ id: String(c.id || c.criterionId || `k${i + 1}`), name: String(c.name || c.label || c.id || `Kriteria ${i + 1}`).trim(), weight: Number(c.weight || 0) })).filter((c) => c.name);
  }
  if (Array.isArray(rubric)) return rubric.map((c, i) => ({ id: String(c.id || c.criterionId || `k${i + 1}`), name: String(c.name || c.label || c.id || `Kriteria ${i + 1}`).trim(), weight: Number(c.weight || 0) })).filter((c) => c.name);
  if (typeof rubric === "string" && rubric.trim()) return parseRubricText(rubric).map((c) => ({ id: c.id, name: c.name, weight: Number(c.weight || 0) }));
  return [];
}

function normalizeCriterionName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function matchCriterionId(candidate, criteria) {
  const target = normalizeCriterionName(candidate);
  if (!target) return null;
  for (const c of criteria) {
    const name = normalizeCriterionName(c.name);
    if (name === target || name.includes(target) || target.includes(name)) return c.id;
  }
  return null;
}
function criterionOverlap(a, b) {
  const tokensA = new Set(normalizeCriterionName(a).split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normalizeCriterionName(b).split(" ").filter((t) => t.length > 2));
  let shared = 0;
  tokensA.forEach((t) => { if (tokensB.has(t)) shared += 1; });
  return shared;
}
function bestFittedCriterion(prompt, focus, outcome, criteria) {
  const source = `${prompt || ""} ${focus || ""} ${outcome || ""}`;
  let best = null;
  let bestScore = -1;
  for (const c of criteria) {
    const score = criterionOverlap(source, c.name);
    if (score > bestScore || (score === bestScore && best && (Number(c.weight) > Number(best.weight) || (Number(c.weight) === Number(best.weight) && String(c.id).localeCompare(String(best.id)) < 0)))) {
      bestScore = score;
      best = c;
    }
  }
  if (!best) {
    const ordered = criteria.slice().sort((a, b) => Number(b.weight) - Number(a.weight) || String(a.id).localeCompare(String(b.id)));
    best = ordered[0];
  }
  return best;
}
function buildQuestionRubricText(question, allCriteria) {
  const ids = (question.criteria || []).map((c) => String(typeof c === "object" ? c.id || c.name : c));
  const subset = (allCriteria || []).filter((c) => ids.includes(String(c.id)));
  if (subset.length === 0) return "";
  const sum = subset.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  return subset.map((c) => `${c.name}: ${sum > 0 ? Math.round((Number(c.weight) / sum) * 100) : 100 / subset.length}%`).join("\n");
}

function syncRubricWithGroundedCriteria(question, allCriteria) {
  if (!question || !Array.isArray(question.criteria)) return question;
  const selectedIds = new Set(question.criteria.map((criterion) => String(typeof criterion === "object" ? criterion.id || criterion.name : criterion)));
  if (selectedIds.size === 0) return { ...question, rubric: "" };

  const sourceRubric = String(question.rubric || "").trim();
  if (sourceRubric.startsWith("{")) {
    try {
      const parsed = JSON.parse(sourceRubric);
      if (parsed.version === "2" && Array.isArray(parsed.criteria)) {
        const selected = parsed.criteria.filter((criterion) => {
          const id = String(criterion.id || criterion.name || "");
          const name = normalizeCriterionName(criterion.name || "");
          return selectedIds.has(id) || [...selectedIds].some((selectedId) => normalizeCriterionName(selectedId) === name);
        });
        if (selected.length) {
          const total = selected.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0) || selected.length;
          const normalized = selected.map((criterion, index) => ({
            ...criterion,
            weight: index === selected.length - 1
              ? Number((100 - selected.slice(0, -1).reduce((sum, item) => sum + Math.round(((Number(item.weight) || 0) / total) * 100), 0)).toFixed(2))
              : Number((((Number(criterion.weight) || 0) / total) * 100).toFixed(2)),
          }));
          return { ...question, rubric: JSON.stringify({ ...parsed, criteria: normalized }) };
        }
      }
    } catch { /* fall through to generated subset rubric */ }
  }

  const subsetText = buildQuestionRubricText(question, allCriteria);
  return subsetText ? { ...question, rubric: subsetText } : question;
}

function enforceLearningOutcomeAlignment(questions, payload) {
  const outcomes = learningOutcomeAlignment.parseLearningOutcomes(payload?.outcomes);
  if (outcomes.length === 0) return questions;
  const enriched = (questions || []).map((question) => learningOutcomeAlignment.enrichQuestionLearningOutcome(question, outcomes));
  const report = learningOutcomeAlignment.validateLearningOutcomeCoverage(enriched, outcomes);
  return enriched.map((question, index) => ({ ...question, learningOutcomeId: report.questionMap.get(index)?.id || question.learningOutcomeId || null, outcome: report.questionMap.get(index)?.text || question.outcome || "" }));
}

function enforceRubricAlignment(questions, payload) {
  const criteria = parseRubricCriteria(payload) || [];
  if (criteria.length === 0) return enforceLearningOutcomeAlignment(questions, payload);
  const byId = new Map(criteria.map((c) => [c.id, c.name]));
  const globalRubric = typeof payload?.rubric === "string" ? String(payload.rubric).trim() : "";
  const mapped = (questions || []).map((question) => {
    if (!question) return question;
    if (!String(question.prompt || "").trim()) return { ...question, criteria: [] };
    const declared = Array.isArray(question.criteria) ? question.criteria.map(String) : [];
    const ids = [];
    for (const d of declared) { const id = matchCriterionId(d, criteria); if (id && !ids.includes(id)) ids.push(id); }
    if (ids.length === 0) { const fit = bestFittedCriterion(question.prompt, question.focus, question.outcome, criteria); if (fit) ids.push(fit.id); }
    return { ...question, criteria: ids };
  });
  const covered = new Set();
  mapped.forEach((q) => (q.criteria || []).forEach((id) => covered.add(String(id))));
  for (const c of criteria) {
    if (covered.has(c.id)) continue;
    const target = mapped.filter((q) => String(q.prompt || "").trim()).map((q) => ({ q, score: criterionOverlap(`${q.prompt} ${q.focus || ""} ${q.outcome || ""}`, c.name) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || String(a.q.id).localeCompare(String(b.q.id)))[0];
    if (!target) continue;
    target.q.criteria.push(c.id);
    covered.add(c.id);
  }
  const finalized = mapped.map((question) => {
    if (!question || !Array.isArray(question.criteria)) return question;
    const questionRubric = String(question.rubric || "").trim();
    const isDefaultRubric = !questionRubric || (globalRubric.length > 0 && questionRubric === globalRubric);
    const next = { ...question, criteria: question.criteria.map((id) => ({ id, name: byId.get(id) || id })) };
    if (isDefaultRubric) { const subsetText = buildQuestionRubricText(next, criteria); if (subsetText) next.rubric = subsetText; }
    return next;
  });
  const grounded = groundQuestionsAgainstRubric(finalized, payload);
  const rubricSynchronized = grounded.map((question) => syncRubricWithGroundedCriteria(question, criteria));
  return enforceLearningOutcomeAlignment(rubricSynchronized, payload);
}

function buildAlignMessages(payload, questions) {
  const rubricCriteria = parseRubricCriteria(payload) || [];
  const outcomes = learningOutcomeAlignment.parseLearningOutcomes(payload?.outcomes);
  const current = (questions || []).map((q, index) => ({ index, prompt: String(q.prompt || "").trim(), focus: String(q.focus || "").trim(), learningOutcomeId: String(q.learningOutcomeId || "").trim(), outcome: String(q.outcome || "").trim(), criteria: Array.isArray(q.criteria) ? q.criteria.map((c) => (typeof c === "object" ? c.name || c.id : c)) : [] }));
  return [{ role: "user", content: JSON.stringify({
    tugas: "Kalibrasi penyelarasan assessment secara pedagogis: setiap Learning Outcome harus terukur oleh minimal satu soal, setiap soal harus memetakan ke tepat satu Learning Outcome utama, dan setiap soal hanya dinilai terhadap kriteria yang benar-benar menghasilkan evidence untuk LO tersebut.",
    topik: payload.topic,
    learning_outcomes: outcomes.map((lo) => ({ id: lo.id, text: lo.text })),
    rubrik: payload.rubric,
    kriteria_rubrik_yang_tersedia: rubricCriteria.map((c) => ({ id: c.id, nama: c.name, bobot: c.weight })),
    aturan_penyelarasan: ["Untuk setiap soal, tentukan tepat satu learningOutcomeId dari daftar learning_outcomes.", "Question harus benar-benar memberi kesempatan siswa mendemonstrasikan kemampuan pada Learning Outcome tersebut, bukan hanya menyebut topiknya.", "Kata kerja tuntutan soal harus selaras dengan tuntutan kognitif Learning Outcome.", "Untuk setiap soal, tentukan SUBSET kriteria rubrik yang BENAR-BENAR diukur oleh substansi soal itu.", "Soal tidak boleh memetakan kriteria yang tidak dapat dibuktikan dari jawaban.", "Seluruh learning outcome wajib tercakup oleh minimal satu soal.", "Seluruh kriteria yang memang dimaksudkan untuk dinilai harus memiliki jalur Question -> Criterion -> Learning Outcome.", "Pertahankan jumlah dan urutan soal persis sama dengan input."].join(". "),
    jumlah_dan_urutan_hasil: "harus sama persis dengan input",
    questions: current,
  }) }];
}
const ALIGN_SCHEMA = 'Format: {"questions":[{"index":0,"prompt":"...","focus":"...","learningOutcomeId":"LO1","outcome":"...","criteria":["nama_kriteria1","nama_kriteria2"],"reason":"..."}]}. Jumlah dan urutan questions HARUS sama dengan input. learningOutcomeId hanya boleh memakai id pada learning_outcomes.';
function mergeCalibration(original, calibrated) {
  const out = (original || []).map((q) => ({ ...q }));
  if (!Array.isArray(calibrated || [])) return out;
  for (const entry of calibrated) {
    const idx = Number(entry?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= out.length) continue;
    if (typeof entry.prompt === "string" && String(entry.prompt).trim()) out[idx].prompt = String(entry.prompt).trim();
    if (typeof entry.focus === "string" && entry.focus.trim()) out[idx].focus = String(entry.focus).trim();
    if (typeof entry.learningOutcomeId === "string" && entry.learningOutcomeId.trim()) out[idx].learningOutcomeId = entry.learningOutcomeId.trim();
    if (typeof entry.outcome === "string" && entry.outcome.trim()) out[idx].outcome = entry.outcome.trim();
    if (Array.isArray(entry.criteria)) out[idx].criteria = entry.criteria.map(String).filter(Boolean);
  }
  return out;
}
async function calibrateSoalRubrik(payload) {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (questions.length === 0) return enforceRubricAlignment(questions, payload);
  let calibrated = null;
  try {
    calibrated = await callOpenRouter(buildAlignMessages(payload, questions), ALIGN_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "align-rubric" });
  } catch (err) { console.error("Gagal kalibrasi AI, memakai alignment deterministik:", err.message); }
  return enforceRubricAlignment(mergeCalibration(questions, calibrated?.questions), payload);
}
async function streamCalibrateSoalRubrik(payload, onChunk) {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  let calibrated = null;
  try {
    const { content } = await streamOpenRouter(buildAlignMessages(payload, questions), ALIGN_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "align-rubric" }, onChunk);
    calibrated = parseJson(content);
  } catch (err) { console.error("Gagal streaming kalibrasi AI, memakai alignment deterministik:", err.message); }
  return enforceRubricAlignment(mergeCalibration(questions, calibrated?.questions), payload);
}
module.exports = {
  name: "rubricAlignment",
  version: "2.0.0",
  parseRubricCriteria,
  enforceRubricAlignment,
  enforceLearningOutcomeAlignment,
  calibrateSoalRubrik,
  streamCalibrateSoalRubrik,
  buildQuestionRubricText,
  mergeCalibration,
  parseLearningOutcomes: learningOutcomeAlignment.parseLearningOutcomes,
  coverageReport: learningOutcomeAlignment.coverageReport,
  mapCriteriaToLearningOutcomes: learningOutcomeAlignment.mapCriteriaToLearningOutcomes,
  async before(context) {
    const assessment = context.assessment;
    const questions = Array.isArray(assessment && assessment.questions) ? assessment.questions : [];
    const rubric = context.rubric || (assessment && assessment.rubric);
    if (!questions.length || !rubric) return context;
    const criteria = Array.isArray(rubric) ? rubric : parseRubricCriteria({ rubric });
    if (!criteria.length) return context;
    const covered = new Set();
    for (const q of questions) {
      const ids = Array.isArray(q.criteria) ? q.criteria.map((c) => String(typeof c === "object" ? c.id || c.name : c)) : [];
      const valid = ids.filter((id) => criteria.some((c) => c.id === id || c.name === id)).slice(0, 3);
      if (valid.length) {
        valid.forEach((id) => covered.add(id));
        q.criteria = valid.map((id) => ({ id, name: criteria.find((c) => c.id === id || c.name === id).name }));
      } else {
        const fit = bestFittedCriterion(q.prompt, q.focus, q.outcome, criteria);
        if (fit) { covered.add(fit.id); q.criteria = [{ id: fit.id, name: fit.name }]; }
      }
    }
    const uncovered = criteria.filter((c) => !covered.has(c.id)).map((c) => c.id);
    const outcomes = learningOutcomeAlignment.parseLearningOutcomes(assessment?.outcomes);
    const outcomeCoverage = outcomes.length ? learningOutcomeAlignment.coverageReport(questions, outcomes) : null;
    context.trace && context.trace.event("RUBRIC_ALIGNMENT", { totalCriteria: criteria.length, coveredCriteria: covered.size, uncoveredCriteria: uncovered, questionCount: questions.length, learningOutcomeCoverage: outcomeCoverage ? { total: outcomeCoverage.total, covered: outcomeCoverage.covered.map((lo) => lo.id), missing: outcomeCoverage.missing.map((lo) => lo.id) } : null });
    context.rubricAlignment = { active: true, covered: [...covered], uncovered, learningOutcomeCoverage: outcomeCoverage };
    return context;
  },
};
