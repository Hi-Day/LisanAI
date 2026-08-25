let clientCsrfToken = null;

export async function postJson(url, payload, fallbackMessage) {
  const headers = { "Content-Type": "application/json" };
  if (clientCsrfToken) {
    headers["X-CSRF-Token"] = clientCsrfToken;
  }
  const response = await fetch(url, {
    method: "POST",
    // Keep the HttpOnly session cookie attached even when the app is served
    // through a production proxy or a different subdomain.
    credentials: "include",
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
  const response = await fetch("/api/auth?action=me", { credentials: "include" });
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

/**
 * Full submission payload (with audio/criteria/evidence) for detail views.
 * The list state intentionally carries lightweight summaries, so detail/open
 * views fetch the complete record on demand.
 */
export async function getSubmissionDetail(submissionId) {
  const response = await fetch(
    `/api/database?action=submission&id=${encodeURIComponent(submissionId)}`,
    { credentials: "include" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat detail submission");
  return data.submission;
}

export async function saveAssessmentToDatabase(assessment) {
  await postJson("/api/database", { action: "save-assessment", payload: assessment }, "Gagal menyimpan penilaian");
}

export async function saveSubmissionToDatabase(submission) {
  await postJson("/api/database", { action: "save-submission", payload: submission }, "Gagal menyimpan submission");
}

export async function submitComplaint(submissionId, questionIndex, reason) {
  return postJson(
    "/api/database",
    { action: "submit-complaint", payload: { submissionId, questionIndex, reason } },
    "Gagal mengirim komplain"
  );
}

export async function seedDemoData(target) {
  return postJson(
    "/api/database",
    { action: "seed-demo", payload: { target } },
    "Gagal mengisi data contoh"
  );
}

export async function removeDemoData() {
  return postJson(
    "/api/database",
    { action: "remove-demo-data" },
    "Gagal menghapus data dummy"
  );
}

/**
 * Stream an AI action from the server via SSE.
 *
 * @param {object} options
 * @param {string} options.action - AI action name.
 * @param {object} options.payload - Payload for the action.
 * @param {function(string):void} options.onChunk - Called with each text delta.
 * @param {function(object):void} options.onResult - Called with the final result data.
 * @param {function(string):void} [options.onError] - Called with an error message.
 * @returns {Promise<object>} Resolves with the final result data.
 */
export async function streamAssessmentAction({ action, payload, onChunk, onResult, onError }) {
  const headers = { "Content-Type": "application/json" };
  if (clientCsrfToken) {
    headers["X-CSRF-Token"] = clientCsrfToken;
  }

  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ action, payload, stream: true }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Gagal memproses permintaan AI");
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("Streaming tidak didukung oleh browser ini");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let resultData = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");

      if (!dataLine) continue;
      let parsed;
      try {
        parsed = JSON.parse(dataLine);
      } catch {
        continue;
      }

      if (parsed.type === "chunk" && typeof parsed.text === "string") {
        if (onChunk) onChunk(parsed.text);
      } else if (parsed.type === "result") {
        resultData = parsed.data || {};
        if (onResult) onResult(resultData);
      } else if (parsed.type === "error") {
        if (onError) onError(parsed.message || "Terjadi kesalahan");
        throw new Error(parsed.message || "Terjadi kesalahan");
      }
    }
  }

  return resultData;
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

export async function addStudentsToClass(payload) {
  const data = await postJson("/api/database", { action: "add-students-to-class", payload }, "Gagal menambahkan siswa ke kelas");
  return data;
}

export async function createStudentsBatch(payload) {
  const data = await postJson("/api/database", { action: "create-students-batch", payload }, "Gagal membuat siswa batch");
  return data;
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
  const data = await postJson("/api/database", { action: "update-assessment", id: assessmentId, payload }, "Gagal mengubah penilaian");
  return data.assessment;
}

export async function deleteAssessment(assessmentId) {
  return postJson("/api/database", { action: "delete-assessment", id: assessmentId }, "Gagal menghapus penilaian");
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

export async function saveQuestionToBank(question) {
  const data = await postJson("/api/database", { action: "save-question-bank", payload: question }, "Gagal menyimpan soal");
  return data.id;
}

export async function listQuestionBank(filter) {
  const data = await postJson("/api/database", { action: "list-question-bank", payload: filter || {} }, "Gagal memuat bank soal");
  return data.questions;
}

export async function deleteQuestionFromBank(questionId) {
  return postJson("/api/database", { action: "delete-question-bank", id: questionId }, "Gagal menghapus soal");
}
