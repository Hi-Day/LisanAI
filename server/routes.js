const { evaluateAnswers, generateQuestions } = require("./assessment-service");
const { clearData, getState, saveAssessment, saveSubmission } = require("./database");
const { readJson, sendJson } = require("./http-utils");

async function handleApiRequest(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    return sendJson(res, 200, await getState());
  }

  if (req.method === "DELETE" && url.pathname === "/api/data") {
    await clearData();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (url.pathname === "/api/assessments") {
    const assessment = await readJson(req);
    await saveAssessment(assessment);
    return sendJson(res, 201, { assessment });
  }

  if (url.pathname === "/api/submissions") {
    const submission = await readJson(req);
    await saveSubmission(submission);
    return sendJson(res, 201, { submission });
  }

  if (url.pathname === "/api/generate-questions") {
    const body = await readJson(req);
    const questions = await generateQuestions(body);
    return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
  }

  if (url.pathname === "/api/evaluate") {
    const body = await readJson(req);
    const evaluation = await evaluateAnswers(body);
    return sendJson(res, 200, { evaluation, model: process.env.OPENROUTER_MODEL });
  }

  return sendJson(res, 404, { error: "Not found" });
}

module.exports = {
  handleApiRequest,
};
