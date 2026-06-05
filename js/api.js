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

async function sendJson(url, method, payload, fallbackMessage) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

export async function getCurrentUser() {
  const response = await fetch("/api/auth/me");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memeriksa session");
  return data;
}

export async function login(payload) {
  return postJson("/api/auth/login", payload, "Login gagal");
}

export async function registerTenant(payload) {
  return postJson("/api/auth/register", payload, "Registrasi gagal");
}

export async function logout() {
  return postJson("/api/auth/logout", {}, "Logout gagal");
}

export async function listUsers() {
  const response = await fetch("/api/users");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat user");
  return data.users;
}

export async function createUser(payload) {
  const data = await postJson("/api/users", payload, "Gagal membuat user");
  return data.user;
}

export async function updateUser(userId, payload) {
  const data = await sendJson(`/api/users/${encodeURIComponent(userId)}`, "PUT", payload, "Gagal mengubah user");
  return data.user;
}

export async function deleteUser(userId) {
  return sendJson(`/api/users/${encodeURIComponent(userId)}`, "DELETE", null, "Gagal menghapus user");
}

export async function loadStateFromDatabase() {
  const response = await fetch("/api/state");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat data dari database");
  return {
    assessments: Array.isArray(data.assessments) ? data.assessments : [],
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    classes: Array.isArray(data.classes) ? data.classes : [],
    memberships: Array.isArray(data.memberships) ? data.memberships : [],
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

export async function improveQuestionsWithAI(config, questions) {
  const data = await postJson(
    "/api/improve-questions",
    { config, questions },
    "Gagal memperbaiki question set"
  );
  return data.questions;
}

export async function createClassroom(name) {
  const data = await postJson("/api/classes", { name }, "Gagal membuat kelas");
  return data.class;
}

export async function updateClassroom(classId, payload) {
  const data = await sendJson(`/api/classes/${encodeURIComponent(classId)}`, "PUT", payload, "Gagal mengubah kelas");
  return data.class;
}

export async function deleteClassroom(classId) {
  return sendJson(`/api/classes/${encodeURIComponent(classId)}`, "DELETE", null, "Gagal menghapus kelas");
}

export async function joinClass(joinCode) {
  const data = await postJson("/api/classes/join", { joinCode }, "Gagal join kelas");
  return data.class;
}

export async function approveJoinRequest(membershipId) {
  return postJson("/api/classes/approve", { membershipId }, "Gagal approve siswa");
}

export async function updateMembership(membershipId, status) {
  return sendJson(`/api/memberships/${encodeURIComponent(membershipId)}`, "PUT", { status }, "Gagal mengubah membership");
}

export async function deleteMembership(membershipId) {
  return sendJson(`/api/memberships/${encodeURIComponent(membershipId)}`, "DELETE", null, "Gagal menghapus membership");
}

export async function updateAssessment(assessmentId, payload) {
  const data = await sendJson(`/api/assessments/${encodeURIComponent(assessmentId)}`, "PUT", payload, "Gagal mengubah assessment");
  return data.assessment;
}

export async function deleteAssessment(assessmentId) {
  return sendJson(`/api/assessments/${encodeURIComponent(assessmentId)}`, "DELETE", null, "Gagal menghapus assessment");
}

export async function recommendAssessmentConfig(topic, difficulty) {
  const data = await postJson(
    "/api/recommend-assessment-config",
    { topic, difficulty },
    "Gagal membuat rekomendasi kompetensi dan rubrik"
  );
  return data.recommendation;
}

export async function evaluateAssessmentWithAI(assessment, answers, studentName, makeSubmission) {
  // Only send text for evaluation
  const textAnswers = answers.map(a => a.text || "");
  
  const data = await postJson(
    "/api/evaluate",
    { assessment, answers: textAnswers, studentName },
    "Gagal menilai jawaban dengan AI"
  );

  // Re-attach audio to the question scores so it can be saved in the submission payload
  const questionScoresWithAudio = data.evaluation.questionScores.map((qs, idx) => ({
    ...qs,
    audio: answers[idx]?.audio || null
  }));

  return makeSubmission({
    assessment,
    studentName,
    finalScore: data.evaluation.finalScore,
    questionScores: questionScoresWithAudio,
    feedback: data.evaluation.feedback,
  });
}
