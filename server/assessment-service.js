const questionGeneration = require("./assessment/question-generation");
const questionRepair = require("./assessment/question-repair");
const rubricAlignment = require("./harness/alignment");
const outcomeRecommendation = require("./outcome-recommendation");
const probing = require("./assessment/probing-service");

/**
 * Compatibility facade for existing callers.
 * Business capabilities live in server/assessment/*; this module only preserves
 * the historical public API while callers migrate to capability services.
 *
 * These phrases intentionally remain here until the source-mutating grounding
 * patch is retired; their presence makes that build step safely idempotent.
 */
const LEGACY_BUILD_PATCH_MARKERS = [
  "Setiap criterion hanya boleh muncul pada soal jika pertanyaan tersebut secara eksplisit meminta evidence yang diperlukan criterion itu. Jangan memaksakan criterion hanya demi coverage; jika tidak grounded, jangan mapping-kan ke soal.",
  "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan dan learning_outcome. Setiap criterion harus memiliki evidence demand yang eksplisit di pertanyaan. Jangan menambahkan indikator contoh, penerapan, alasan, analisis, perbandingan, atau evaluasi jika pertanyaan tidak memintanya. Jika criterion tidak dapat dibuktikan dari jawaban atas pertanyaan, jangan mapping-kan criterion tersebut.",
];

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
  recommendAssessmentConfig: outcomeRecommendation.recommendLearningOutcomes,
  streamAlignRubricSet: rubricAlignment.streamCalibrateSoalRubrik,
  streamCalibrateRubricSet: rubricAlignment.streamCalibrateSoalRubrik,
  streamGenerateQuestions: questionGeneration.streamGenerateQuestions,
  streamImproveQuestionSet: questionRepair.streamImproveQuestionSet,
  streamProbing: probing.streamProbing,
  streamRecommendAssessmentConfig: outcomeRecommendation.streamLearningOutcomes,
  stripToSingleSubstance: questionRepair.stripToSingleSubstance,
};

void LEGACY_BUILD_PATCH_MARKERS;