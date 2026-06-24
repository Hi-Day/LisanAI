let clientCsrfToken = null;

async function postJson(url, payload, fallbackMessage) {
  const headers = { "Content-Type": "application/json" };
  if (clientCsrfToken) {
    headers["X-CSRF-Token"] = clientCsrfToken;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (data.csrfToken) {
    clientCsrfToken = data.csrfToken;
  }
  if (!response.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

export async function getCurrentUser() {
  const response = await fetch("/api/auth?action=me");
  const data = await response.json();
  if (data.csrfToken) {
    clientCsrfToken = data.csrfToken;
  }
  if (!response.ok) throw new Error(data.error || "Gagal memeriksa session");
  return data;
}

export async function login(payload) {
  return postJson("/api/auth", { action: "login", payload }, "Login gagal");
}

export async function registerTenant(payload) {
  return postJson("/api/auth", { action: "register", payload }, "Registrasi gagal");
}

export async function logout() {
  return postJson("/api/auth", { action: "logout" }, "Logout gagal");
}

export async function listUsers() {
  const response = await fetch("/api/database?action=users");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat user");
  return data.users;
}

export async function createUser(payload) {
  const data = await postJson("/api/database", { action: "create-user", payload }, "Gagal membuat user");
  return data.user;
}

export async function createUsersBatch(payload) {
  const data = await postJson("/api/database", { action: "create-users-batch", payload }, "Gagal membuat user batch");
  return data;
}

export async function updateUser(userId, payload) {
  const data = await postJson("/api/database", { action: "update-user", id: userId, payload }, "Gagal mengubah user");
  return data.user;
}

export async function deleteUser(userId) {
  return postJson("/api/database", { action: "delete-user", id: userId }, "Gagal menghapus user");
}

export async function loadStateFromDatabase() {
  const response = await fetch("/api/database?action=state");
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
  await postJson("/api/database", { action: "save-assessment", payload: assessment }, "Gagal menyimpan assessment");
}

export async function saveSubmissionToDatabase(submission) {
  await postJson("/api/database", { action: "save-submission", payload: submission }, "Gagal menyimpan submission");
}

export async function clearDatabase() {
  await postJson("/api/database", { action: "clear-data" }, "Gagal reset database");
}

export async function generateQuestionsWithAI(config) {
  const data = await postJson(
    "/api/assessment",
    { action: "generate-questions", payload: config },
    "Gagal generate soal dengan AI"
  );
  return data.questions;
}

export async function improveQuestionsWithAI(config, questions) {
  const data = await postJson(
    "/api/assessment",
    { action: "improve-questions", payload: { config, questions } },
    "Gagal memperbaiki question set"
  );
  return data.questions;
}

export async function createClassroom(name) {
  const data = await postJson("/api/database", { action: "create-class", payload: { name } }, "Gagal membuat kelas");
  return data.class;
}

export async function updateClassroom(classId, payload) {
  const data = await postJson("/api/database", { action: "update-class", id: classId, payload }, "Gagal mengubah kelas");
  return data.class;
}

export async function deleteClassroom(classId) {
  return postJson("/api/database", { action: "delete-class", id: classId }, "Gagal menghapus kelas");
}

export async function joinClass(joinCode) {
  const data = await postJson("/api/database", { action: "join-class", payload: { joinCode } }, "Gagal join kelas");
  return data.class;
}

export async function approveJoinRequest(membershipId) {
  return postJson("/api/database", { action: "approve-membership", payload: { membershipId } }, "Gagal approve siswa");
}

export async function updateMembership(membershipId, status) {
  return postJson("/api/database", { action: "update-membership", id: membershipId, payload: { status } }, "Gagal mengubah membership");
}

export async function deleteMembership(membershipId) {
  return postJson("/api/database", { action: "delete-membership", id: membershipId }, "Gagal menghapus membership");
}

export async function updateAssessment(assessmentId, payload) {
  const data = await postJson("/api/database", { action: "update-assessment", id: assessmentId, payload }, "Gagal mengubah assessment");
  return data.assessment;
}

export async function deleteAssessment(assessmentId) {
  return postJson("/api/database", { action: "delete-assessment", id: assessmentId }, "Gagal menghapus assessment");
}

export async function recommendAssessmentConfig(topic, difficulty) {
  const data = await postJson(
    "/api/assessment",
    { action: "recommend-assessment-config", payload: { topic, difficulty } },
    "Gagal membuat rekomendasi kompetensi dan rubrik"
  );
  return data.recommendation;
}

export async function evaluateAssessmentWithAI(assessment, answers, studentName, makeSubmission) {
  const textAnswers = answers.map(a => a.text || "");
  
  const data = await postJson(
    "/api/assessment",
    { action: "evaluate", payload: { assessment, answers: textAnswers, studentName } },
    "Gagal menilai jawaban dengan AI"
  );

  const questionScoresWithMetadata = data.evaluation.questionScores.map((qs, idx) => ({
    ...qs,
    audio: answers[idx]?.audio || null,
    duration: answers[idx]?.duration || 0
  }));

  return makeSubmission({
    assessment,
    studentName,
    finalScore: data.evaluation.finalScore,
    questionScores: questionScoresWithMetadata,
    feedback: data.evaluation.feedback,
  });
}

export async function getSimulationData() {
  const response = await fetch("/api/auth?action=simulation");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat data simulasi");
  return data;
}

export async function simulateLogin(userId) {
  return postJson("/api/auth", { action: "simulate-login", payload: { userId } }, "Gagal simulasi login");
}
