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
module.exports = {
  alignRubricSet: rubricAlignment.calibrateSoalRubrik,
  calibrateRubricSet: rubricAlignment.calibrateSoalRubrik,
  enforceLearningOutcomeAlignment: rubricAlignment.enforceLearningOutcomeAlignment,
  enforceOralScenario: questionRepair.repairOralScenario,
  enforceRubricAlignment: rubricAlignment.enforceRubricAlignment,
  enforceSingleSubstance: questionRepair.repairSingleSubstance,
  generateProbing: probing.generateProbing,
  generateQuestions: questionGeneration.generateQuestions,
  improveQuestionSet: questionRepair.improveQuestionSet,
  isClosedRecallQuestion: questionRepair.isClosedRecallQuestion,
  isMultiPartPrompt: questionRepair.isMultiPartPrompt,
  isOpenOralQuestion: questionRepair.isOpenOralQuestion,
  mergeCalibration: rubricAlignment.mergeCalibration,
  openClosedQuestion: questionRepair.openClosedQuestion,
  parseRubricCriteria: rubricAlignment.parseRubricCriteria,
  recommendAssessmentConfig: outcomeRecommendation.recommendLearningOutcomes || outcomeRecommendation.recommendAssessmentConfig,
  streamAlignRubricSet: rubricAlignment.streamCalibrateSoalRubrik,
  streamCalibrateRubricSet: rubricAlignment.streamCalibrateSoalRubrik,
  streamGenerateQuestions: questionGeneration.streamGenerateQuestions,
  streamImproveQuestionSet: questionRepair.streamImproveQuestionSet,
  streamProbing: probing.streamProbing,
  streamRecommendAssessmentConfig: outcomeRecommendation.streamLearningOutcomes || outcomeRecommendation.streamRecommendAssessmentConfig,
  stripToSingleSubstance: questionRepair.stripToSingleSubstance,
};