const {
  parseLearningOutcomes,
  resolveLearningOutcomes,
  coverageReport,
} = require("./harness/learning-outcome-alignment");

function integrityError(message, code, details = {}) {
  const error = Object.assign(new Error(message), { status: 400, code });
  error.integrity = details;
  return error;
}

function validateAssessmentIntegrity(assessment) {
  const questions = Array.isArray(assessment?.questions) ? assessment.questions : [];
  const outcomes = parseLearningOutcomes(assessment?.outcomes);
  if (!questions.length) throw integrityError("Assessment wajib memiliki minimal satu soal.", "ASSESSMENT_QUESTIONS_REQUIRED", { questionCount: 0 });
  if (!outcomes.length) return { valid: true, outcomeCount: 0, questionCount: questions.length, mappedQuestions: questions.length, uncoveredOutcomeIds: [], warnings: ["Assessment tidak memiliki Learning Outcome eksplisit."] };
  const details = questions.map((question, index) => {
    const mapped = resolveLearningOutcomes(question, outcomes);
    return { index, questionId: question?.id || null, learningOutcomeIds: mapped.map((lo) => lo.id), mapped: mapped.length > 0 };
  });
  const unmapped = details.filter((item) => !item.mapped);
  if (unmapped.length) throw integrityError(`Ada ${unmapped.length} soal yang tidak terpetakan ke Learning Outcome.`, "ASSESSMENT_QUESTION_LO_UNMAPPED", { questionCount: questions.length, unmapped });
  const coverage = coverageReport(questions, outcomes);
  if (coverage.missing.length) throw integrityError(`Assessment belum mengukur semua Learning Outcome: ${coverage.missing.map((lo) => `${lo.id} — ${lo.text}`).join("; ")}`, "ASSESSMENT_LO_COVERAGE_INCOMPLETE", { questionCount: questions.length, outcomeCount: outcomes.length, coveredOutcomeIds: coverage.covered.map((lo) => lo.id), missingOutcomes: coverage.missing.map((lo) => ({ id: lo.id, text: lo.text })), coveragePercent: coverage.coveragePercent });
  return { valid: true, outcomeCount: outcomes.length, questionCount: questions.length, mappedQuestions: details.length, coveredOutcomeIds: coverage.covered.map((lo) => lo.id), uncoveredOutcomeIds: [], coveragePercent: coverage.coveragePercent, warnings: [] };
}

module.exports = { validateAssessmentIntegrity };