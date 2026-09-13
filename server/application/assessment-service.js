const {
  generateQuestions,
  improveQuestionSet,
  calibrateRubricSet,
  streamAlignRubricSet,
  streamGenerateQuestions,
  streamImproveQuestionSet,
} = require("../assessment-service");
const { streamLearningOutcomes, recommendLearningOutcomes } = require("../outcome-recommendation");
const { repairPedagogicalGrounding, streamRepairPedagogicalGrounding } = require("../pedagogical-repair");
const { generateCoverageQuestion, streamCoverageQuestion } = require("../pedagogical-coverage");

const ACTIONS = [
  "generate-questions",
  "align-rubric",
  "improve-questions",
  "repair-pedagogical-grounding",
  "generate-question-for-uncovered-criterion",
  "recommend-learning-outcomes",
  "recommend-assessment-config",
];

function recommendationFromOutcomes(outcomes) {
  const normalized = Array.isArray(outcomes) ? outcomes.filter(Boolean).slice(0, 3) : [];
  return { outcomes: normalized.join("\n"), items: normalized, count: normalized.length };
}

function isSupportedAction(action) {
  return ACTIONS.includes(action);
}

async function executeAction(action, payload) {
  if (action === "generate-questions") return { questions: await generateQuestions(payload) };
  if (action === "align-rubric") return { questions: await calibrateRubricSet(payload), aligned: true };
  if (action === "improve-questions") return { questions: await improveQuestionSet(payload) };
  if (action === "repair-pedagogical-grounding") return await repairPedagogicalGrounding(payload);
  if (action === "generate-question-for-uncovered-criterion") return { question: await generateCoverageQuestion(payload) };
  const outcomes = await recommendLearningOutcomes({ ...payload, count: 3 });
  return { recommendation: recommendationFromOutcomes(outcomes), outcomes, count: outcomes.length };
}

async function executeStreamingAction(action, payload, onEvent) {
  if (action === "generate-questions") {
    return { questions: await streamGenerateQuestions(payload, onEvent) };
  }
  if (action === "align-rubric") {
    return { questions: await streamAlignRubricSet(payload, onEvent), aligned: true };
  }
  if (action === "improve-questions") {
    return { questions: await streamImproveQuestionSet(payload, onEvent) };
  }
  if (action === "repair-pedagogical-grounding") {
    return await streamRepairPedagogicalGrounding(payload, onEvent);
  }
  if (action === "generate-question-for-uncovered-criterion") {
    return { question: await streamCoverageQuestion(payload, onEvent) };
  }
  const outcomes = await streamLearningOutcomes({ ...payload, count: 3 }, onEvent);
  return { recommendation: recommendationFromOutcomes(outcomes), outcomes, count: outcomes.length };
}

module.exports = {
  ACTIONS,
  executeAction,
  executeStreamingAction,
  isSupportedAction,
  recommendationFromOutcomes,
};
