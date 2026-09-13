const questionGeneration = require("./assessment/question-generation");
const questionRepair = require("./assessment/question-repair");
const rubricAlignment = require("./harness/alignment");
const outcomeRecommendation = require("./outcome-recommendation");
const probing = require("./assessment/probing-service");

/**
 * Compatibility facade for existing callers.
 * Business capabilities live in server/assessment/*; this module only preserves
 * the historical public API while callers migrate to capability services.
 */

/**
 * Historical guardrail order for generated questions: single substance, then
 * oral-scenario readiness, then deterministic rubric alignment.
 */
async function applyQuestionGuardrails(questions, payload) {
  const singleSubstance = await questionRepair.repairSingleSubstance(questions, payload);
  const oralReady = await questionRepair.repairOralScenario(singleSubstance, payload);
  return rubricAlignment.enforceRubricAlignment(oralReady, payload);
}

async function generateQuestions(payload) {
  return applyQuestionGuardrails(await questionGeneration.generateQuestions(payload), payload);
}

async function streamGenerateQuestions(payload, onChunk) {
  return applyQuestionGuardrails(await questionGeneration.streamGenerateQuestions(payload, onChunk), payload);
}

// Rubric calibration takes the assessment config with the questions attached,
// while callers pass { config, questions }.
function normalizeCalibrationPayload(payload) {
  const config = payload.config || payload;
  return { ...config, questions: Array.isArray(payload.questions) ? payload.questions : [] };
}

async function calibrateRubricSet(payload) {
  const aligned = await rubricAlignment.calibrateSoalRubrik(normalizeCalibrationPayload(payload));
  return Array.isArray(aligned) ? aligned : [];
}

async function streamCalibrateRubricSet(payload, onChunk) {
  const aligned = await rubricAlignment.streamCalibrateSoalRubrik(normalizeCalibrationPayload(payload), onChunk);
  return Array.isArray(aligned) ? aligned : [];
}

// Recommendation consumers (api/v1 + the wizard) read `outcomes` as text, with
// the individual outcomes exposed alongside it; rubric is never topic-level.
async function recommendAssessmentConfig(payload) {
  const outcomes = await outcomeRecommendation.recommendLearningOutcomes(payload);
  const items = (Array.isArray(outcomes) ? outcomes : [outcomes]).filter(Boolean);
  return { outcomes: items.join("\n"), items, count: items.length };
}

module.exports = {
  alignRubricSet: calibrateRubricSet,
  calibrateRubricSet,
  enforceLearningOutcomeAlignment: rubricAlignment.enforceLearningOutcomeAlignment,
  enforceOralScenario: questionRepair.repairOralScenario,
  enforceRubricAlignment: rubricAlignment.enforceRubricAlignment,
  enforceSingleSubstance: questionRepair.repairSingleSubstance,
  generateProbing: probing.generateProbing,
  generateQuestions,
  improveQuestionSet: questionRepair.improveQuestionSet,
  isClosedRecallQuestion: questionRepair.isClosedRecallQuestion,
  isMultiPartPrompt: questionRepair.isMultiPartPrompt,
  isOpenOralQuestion: questionRepair.isOpenOralQuestion,
  mergeCalibration: rubricAlignment.mergeCalibration,
  openClosedQuestion: questionRepair.openClosedQuestion,
  parseRubricCriteria: rubricAlignment.parseRubricCriteria,
  recommendAssessmentConfig,
  streamAlignRubricSet: streamCalibrateRubricSet,
  streamCalibrateRubricSet,
  streamGenerateQuestions,
  streamImproveQuestionSet: questionRepair.streamImproveQuestionSet,
  streamProbing: probing.streamProbing,
  streamRecommendAssessmentConfig: outcomeRecommendation.streamLearningOutcomes,
  stripToSingleSubstance: questionRepair.stripToSingleSubstance,
};
