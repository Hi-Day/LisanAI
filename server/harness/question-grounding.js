/**
 * Deterministic Question -> Evidence -> Criterion grounding.
 *
 * A rubric criterion is valid for a question only when the question explicitly
 * elicits evidence that can demonstrate that criterion. Semantic similarity
 * between criterion names and question text is never sufficient.
 */

const DEMAND_PATTERNS = {
  identification: /\b(?:identifikasi|pilih|tentukan|sebutkan|nama(?:kan)?|menentukan|memilih)\b/i,
  reasoning: /\b(?:mengapa|kenapa|alasan|jelaskan\s+(?:mengapa|alasan|pilihan|hubungan|proses)|uraikan\s+alasan|argumentasi|argumen)\b/i,
  application: /\b(?:contoh|misal|misalnya|penerapan|diterapkan|kasus|situasi konkret|situasi)\b/i,
  comparison: /\b(?:bandingkan|perbandingan|persamaan|perbedaan|berbeda)\b/i,
  analysis: /\b(?:analisis|analisa|hubungan sebab|sebab-akibat|menghubungkan|hubungkan|dampak|pengaruh)\b/i,
  evaluation: /\b(?:evaluasi|nilai|menilai|kritisi|kritik|kelebihan|kelemahan|batasan)\b/i,
  procedure: /\b(?:langkah|prosedur|cara|tahapan|proses)\b/i,
};

const CRITERION_DEMANDS = [
  { type: "application", pattern: /\b(?:contoh|penerapan|kasus|situasi)\b/i },
  { type: "comparison", pattern: /\b(?:banding|perbandingan|persamaan|perbedaan)\b/i },
  { type: "analysis", pattern: /\b(?:analisis|sebab|akibat|dampak|pengaruh|hubungan)\b/i },
  { type: "evaluation", pattern: /\b(?:evaluasi|menilai|kritik|kelebihan|kelemahan|batasan)\b/i },
  { type: "reasoning", pattern: /\b(?:alasan|argument|argumen|kedalaman)\b/i },
  { type: "procedure", pattern: /\b(?:langkah|prosedur|cara|tahapan|proses)\b/i },
  { type: "identification", pattern: /\b(?:identifikasi|ketepatan|pemilihan|menyebut|nama)\b/i },
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferCriterionDemand(criterionName) {
  const name = normalizeText(criterionName).toLowerCase();
  return CRITERION_DEMANDS.find((entry) => entry.pattern.test(name))?.type || null;
}

function hasEvidenceDemand(prompt, demand) {
  const text = normalizeText(prompt);
  return Boolean(DEMAND_PATTERNS[demand]?.test(text));
}

function criterionIsGrounded(prompt, criterionName) {
  const demand = inferCriterionDemand(criterionName);
  if (!demand) return true;
  return hasEvidenceDemand(prompt, demand);
}

function isUnderspecifiedSelection(prompt) {
  const text = normalizeText(prompt);
  if (!text) return false;
  if (!/^pilih(?:lah)?\b/i.test(text)) return false;
  return !DEMAND_PATTERNS.reasoning.test(text);
}

/**
 * Repair only the common vague-selection pattern. This keeps one central
 * decision task while making the requested evidence (the student's reason)
 * explicit. We deliberately do NOT append an example/application request:
 * adding an extra evidence dimension would change the substance of the item.
 */
function repairQuestionClarity(prompt) {
  const text = normalizeText(prompt);
  if (!isUnderspecifiedSelection(text)) return text;
  const withoutEnding = text.replace(/[.!?]+$/, "").trim();
  return `${withoutEnding}, lalu jelaskan alasan pilihan Anda.`;
}

function groundQuestion(question, payload) {
  const originalPrompt = normalizeText(question?.prompt);
  const repairedPrompt = repairQuestionClarity(originalPrompt);
  const declared = Array.isArray(question?.criteria) ? question.criteria : [];
  const criteria = declared
    .map((criterion) => {
      if (criterion && typeof criterion === "object") {
        return {
          ...criterion,
          id: String(criterion.id || criterion.name || "").trim(),
          name: normalizeText(criterion.name || criterion.id),
        };
      }
      return { id: String(criterion), name: normalizeText(criterion) };
    })
    .filter((criterion) => criterion.name);

  const grounded = [];
  const removed = [];
  for (const criterion of criteria) {
    if (criterionIsGrounded(repairedPrompt, criterion.name)) grounded.push(criterion);
    else removed.push({
      id: criterion.id,
      name: criterion.name,
      demand: inferCriterionDemand(criterion.name),
      reason: "Question tidak secara eksplisit meminta evidence yang diperlukan criterion ini.",
    });
  }

  return {
    ...question,
    prompt: repairedPrompt,
    criteria: grounded,
    evidenceGrounding: {
      version: 1,
      status: removed.length ? "PARTIAL" : "GROUNDED",
      originalPrompt,
      repairedPrompt: repairedPrompt !== originalPrompt,
      groundedCriteria: grounded.map((criterion) => criterion.name),
      removedCriteria: removed,
      tenantScoped: Boolean(payload?.tenantId),
    },
  };
}

function groundQuestionsAgainstRubric(questions, payload = {}) {
  return (questions || []).map((question) => groundQuestion(question, payload));
}

function validateQuestionCriterionGrounding(question) {
  const prompt = normalizeText(question?.prompt);
  const criteria = Array.isArray(question?.criteria) ? question.criteria : [];
  const invalid = criteria.filter((criterion) => !criterionIsGrounded(prompt, criterion?.name || criterion?.id));
  return {
    valid: invalid.length === 0,
    invalidCriteria: invalid.map((criterion) => criterion?.name || criterion?.id),
  };
}

module.exports = {
  CRITERION_DEMANDS,
  DEMAND_PATTERNS,
  inferCriterionDemand,
  hasEvidenceDemand,
  criterionIsGrounded,
  isUnderspecifiedSelection,
  repairQuestionClarity,
  groundQuestion,
  groundQuestionsAgainstRubric,
  validateQuestionCriterionGrounding,
};
