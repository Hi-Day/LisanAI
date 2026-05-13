async function postJson(url, payload, fallbackMessage) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

export async function loadStateFromDatabase() {
  const response = await fetch("/api/state");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat data dari database");
  return {
    assessments: Array.isArray(data.assessments) ? data.assessments : [],
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
  };
}

export async function saveAssessmentToDatabase(assessment) {
  await postJson("/api/assessments", assessment, "Gagal menyimpan assessment");
}

export async function saveSubmissionToDatabase(submission) {
  await postJson("/api/submissions", submission, "Gagal menyimpan submission");
}

export async function clearDatabase() {
  const response = await fetch("/api/data", { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal reset database");
}

export async function generateQuestionsWithAI(config) {
  const data = await postJson(
    "/api/generate-questions",
    config,
    "Gagal generate soal dengan AI"
  );
  return data.questions;
}

export async function evaluateAssessmentWithAI(assessment, answers, studentName, makeSubmission) {
  const data = await postJson(
    "/api/evaluate",
    { assessment, answers, studentName },
    "Gagal menilai jawaban dengan AI"
  );

  return makeSubmission({
    assessment,
    studentName,
    finalScore: data.evaluation.finalScore,
    questionScores: data.evaluation.questionScores,
    feedback: data.evaluation.feedback,
  });
}
