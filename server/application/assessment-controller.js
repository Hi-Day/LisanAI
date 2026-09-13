const {
  generateQuestions, improveQuestionSet,
  streamAlignRubricSet, streamGenerateQuestions, streamImproveQuestionSet,
} = require("../assessment-service");
const { streamLearningOutcomes, recommendLearningOutcomes } = require("../outcome-recommendation");
const { ensureDatabase } = require("../bootstrap");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const { beginStream, createChunkWriter, endStream, writeEvent } = require("../http/sse");

function recommendationFromOutcomes(outcomes) {
  const normalized = Array.isArray(outcomes) ? outcomes.filter(Boolean).slice(0, 3) : [];
  return { outcomes: normalized.join("\n"), items: normalized, count: normalized.length };
}

async function handleStreamingAction(res, auth, action, payload) {
  beginStream(res);
  const onChunk = createChunkWriter(res);
  try {
    let result;
    if (action === "generate-questions") { result = await streamGenerateQuestions(payload, onChunk); writeEvent(res, { type: "result", data: { questions: result } }); }
    else if (action === "align-rubric") { result = await streamAlignRubricSet(payload, onChunk); writeEvent(res, { type: "result", data: { questions: result, aligned: true } }); }
    else if (action === "improve-questions") { result = await streamImproveQuestionSet(payload, onChunk); writeEvent(res, { type: "result", data: { questions: result } }); }
    else if (action === "repair-pedagogical-grounding") { const { streamRepairPedagogicalGrounding } = require("../pedagogical-repair"); result = await streamRepairPedagogicalGrounding(payload, onChunk); writeEvent(res, { type: "result", data: result }); }
    else if (action === "generate-question-for-uncovered-criterion") { const { streamCoverageQuestion } = require("../pedagogical-coverage"); result = await streamCoverageQuestion(payload, onChunk); writeEvent(res, { type: "result", data: { question: result } }); }
    else if (action === "recommend-learning-outcomes" || action === "recommend-assessment-config") { result = await streamLearningOutcomes({ ...payload, count: 3 }, (event) => { writeEvent(res, event); }); writeEvent(res, { type: "result", data: { recommendation: recommendationFromOutcomes(result), outcomes: result, count: result.length } }); }
    else writeEvent(res, { type: "error", message: "Action not found" });
  } catch (error) { console.error(error); writeEvent(res, { type: "error", message: error.message || "Server error" }); }
  finally { endStream(res); }
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const security = await requireAuthenticatedRequest(req, res, { rateLimit: "assessment", rateLimitOptions: { limit: 30, windowMs: 60_000 } });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher"])) return;
    const body = await readJson(req); const { action, payload, stream } = body;
    if (payload) { payload.tenantId = auth.tenant.id; payload.userId = auth.user.id; }
    if (!["generate-questions", "align-rubric", "improve-questions", "repair-pedagogical-grounding", "generate-question-for-uncovered-criterion", "recommend-learning-outcomes", "recommend-assessment-config"].includes(action)) return sendJson(res, 404, { error: "Action not found" });
    if (stream === true) return handleStreamingAction(res, auth, action, payload);
    if (action === "generate-questions") return sendJson(res, 200, { questions: await generateQuestions(payload), model: process.env.OPENROUTER_MODEL });
    if (action === "align-rubric") { const { calibrateRubricSet } = require("../assessment-service"); return sendJson(res, 200, { questions: await calibrateRubricSet(payload), model: process.env.OPENROUTER_MODEL, aligned: true }); }
    if (action === "improve-questions") return sendJson(res, 200, { questions: await improveQuestionSet(payload), model: process.env.OPENROUTER_MODEL });
    if (action === "repair-pedagogical-grounding") { const { repairPedagogicalGrounding } = require("../pedagogical-repair"); return sendJson(res, 200, { ...(await repairPedagogicalGrounding(payload)), model: process.env.OPENROUTER_MODEL }); }
    if (action === "generate-question-for-uncovered-criterion") { const { generateCoverageQuestion } = require("../pedagogical-coverage"); return sendJson(res, 200, { question: await generateCoverageQuestion(payload), model: process.env.OPENROUTER_MODEL }); }
    const outcomes = await recommendLearningOutcomes({ ...payload, count: 3 });
    return sendJson(res, 200, { recommendation: recommendationFromOutcomes(outcomes), outcomes, count: outcomes.length, model: process.env.OPENROUTER_MODEL });
  } catch (error) { console.error(error); return sendJson(res, error.status || 500, { error: error.message || "Server error" }); }
};
