import("/js/learning-outcome-trend.js").catch(() => {});import("/js/probing-gate.js").then(m=>m.installProbingGate()).catch(()=>{});import("/js/pedagogical-gate.js").catch(()=>{});import("/js/assessment-outcomes-ux.js").catch(()=>{});import("/js/assessment-outcomes-ai.js").catch(()=>{});
(function enhanceAssessmentWizardUX() {
  function apply() {
    const form = document.getElementById("assessmentForm");
    const panel = form?.querySelector('[data-wizard-panel="1"]');
    if (!form || !panel || panel.dataset.uxEnhanced === "1") return;
    const classLabel = document.getElementById("classSelect")?.closest("label");
    const countLabel = document.getElementById("questionCount")?.closest("label");
    const difficultyLabel = document.getElementById("difficulty")?.closest("label");
    const timeLimitLabel = document.getElementById("timeLimit")?.closest("label");
    const attemptsLabel = document.getElementById("maxAttempts")?.closest("label");
    const examplesLabel = document.getElementById("examples")?.closest("label");
    const checks = panel.querySelector(":scope > .wizard-checks");
    const classRow = classLabel?.parentElement?.classList.contains("form-row-2") ? classLabel.parentElement : null;
    const countRow = countLabel?.parentElement?.classList.contains("form-row-2") ? countLabel.parentElement : null;
    if (!classLabel || !countLabel || !difficultyLabel || !timeLimitLabel || !attemptsLabel) return;
    const coreGrid = document.createElement("div");
    coreGrid.className = "assessment-core-grid";
    coreGrid.setAttribute("aria-label", "Pengaturan utama penilaian");
    classLabel.remove(); countLabel.remove(); coreGrid.append(classLabel, countLabel);
    const outcomesLabel = document.getElementById("outcomes")?.closest("label");
    outcomesLabel?.after(coreGrid);
    if (classRow) classRow.remove();
    if (countRow && countRow !== classRow) countRow.remove();
    const advanced = document.createElement("details");
    advanced.className = "assessment-advanced-settings";
    const summary = document.createElement("summary"); summary.textContent = "⚙ Pengaturan lanjutan";
    const hint = document.createElement("p"); hint.className = "assessment-advanced-hint"; hint.textContent = "Gunakan bila perlu. Pengaturan utama di atas sudah cukup untuk membuat penilaian.";
    const body = document.createElement("div"); body.className = "assessment-advanced-body";
    advanced.append(summary, hint, body);
    [difficultyLabel, timeLimitLabel, attemptsLabel, checks, examplesLabel].forEach((node) => { if (node) body.appendChild(node); });
    panel.appendChild(advanced); panel.dataset.uxEnhanced = "1";
  }
  function start() {
    apply();
    if (!document.getElementById("assessmentForm")?.querySelector('[data-wizard-panel="1"]')) requestAnimationFrame(start);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

(function installLisanUIPolish() {
  const style = document.createElement("style");
  style.id = "lisan-ui-polish";
  style.textContent = "\n    #probingGatePanel { margin: 0 0 20px; }\n    #probingGatePanel.is-empty { display: none; }\n    .probing-gate-panel { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); box-shadow: var(--shadow-subtle); overflow: hidden; }\n    .probing-gate-heading { padding: 18px 20px; }\n    .probing-gate-heading h3 { margin: 0 0 5px; }\n    .probing-gate-heading p { margin: 0; color: var(--muted); line-height: 1.5; }\n    .probing-gate-list-wrap { padding: 0 20px 20px; }\n    @keyframes lisanSmoothCaret { 0%, 42% { opacity: 1; } 50%, 92% { opacity: 0.2; } 100% { opacity: 1; } }\n    @keyframes lisanSmoothShimmer { 0% { background-position: 180% 0; } 100% { background-position: -80% 0; } }\n    @keyframes lisanSmoothSpin { to { transform: rotate(360deg); } }\n    .probing-caret, .probing-stream-caret { animation: lisanSmoothCaret 1.8s ease-in-out infinite !important; }\n    .skeleton, .ai-skeleton-card { animation: lisanSmoothShimmer 2.8s ease-in-out infinite !important; }\n    .ai-stream-spinner, .loading-spinner, .spinner, .button-spinner, .evaluation-spinner { animation: lisanSmoothSpin 1.8s linear infinite !important; }\n    .recording-indicator, .record-button.recording::before, .record-button.recording::after { animation-duration: 1.8s !important; animation-timing-function: ease-in-out !important; }\n    .fade-in, .fadeIn { animation-duration: 0.45s !important; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1) !important; }\n    @media (prefers-reduced-motion: reduce) { #probingGatePanel *, .skeleton, .ai-skeleton-card { animation: none !important; } }\n  ";
  document.head.appendChild(style);
})();

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/js/api.js
var api_exports = {};
__export(api_exports, {
  addStudentsToClass: () => addStudentsToClass,
  approveJoinRequest: () => approveJoinRequest,
  createClassroom: () => createClassroom,
  createStudentsBatch: () => createStudentsBatch,
  createUser: () => createUser,
  createUsersBatch: () => createUsersBatch,
  deleteAssessment: () => deleteAssessment,
  deleteClassroom: () => deleteClassroom,
  deleteMembership: () => deleteMembership,
  deleteQuestionFromBank: () => deleteQuestionFromBank,
  deleteUser: () => deleteUser,
  getCurrentUser: () => getCurrentUser,
  getSimulationData: () => getSimulationData,
  getSubmissionDetail: () => getSubmissionDetail,
  joinClass: () => joinClass,
  listQuestionBank: () => listQuestionBank,
  listUsers: () => listUsers,
  loadStateFromDatabase: () => loadStateFromDatabase,
  login: () => login,
  logout: () => logout,
  postJson: () => postJson,
  registerTenant: () => registerTenant,
  removeDemoData: () => removeDemoData,
  saveAssessmentToDatabase: () => saveAssessmentToDatabase,
  saveQuestionToBank: () => saveQuestionToBank,
  saveSubmissionToDatabase: () => saveSubmissionToDatabase,
  seedDemoData: () => seedDemoData,
  simulateLogin: () => simulateLogin,
  streamAssessmentAction: () => streamAssessmentAction,
  submitComplaint: () => submitComplaint,
  updateAssessment: () => updateAssessment,
  updateClassroom: () => updateClassroom,
  updateMembership: () => updateMembership,
  updateUser: () => updateUser
});
async function postJson(url, payload, fallbackMessage) {
  const headers = { "Content-Type": "application/json" };
  if (clientCsrfToken) {
    headers["X-CSRF-Token"] = clientCsrfToken;
  }
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (data.csrfToken) {
    clientCsrfToken = data.csrfToken;
  }
  if (!response.ok) throw new Error(data.error || fallbackMessage);
  return data;
}
async function getCurrentUser() {
  const response = await fetch("/api/auth?action=me", { credentials: "include" });
  const data = await response.json();
  if (data.csrfToken) {
    clientCsrfToken = data.csrfToken;
  }
  if (!response.ok) throw new Error(data.error || "Gagal memeriksa session");
  return data;
}
async function login(payload) {
  return postJson("/api/auth", { action: "login", payload }, "Login gagal");
}
async function registerTenant(payload) {
  return postJson("/api/auth", { action: "register", payload }, "Registrasi gagal");
}
async function logout() {
  return postJson("/api/auth", { action: "logout" }, "Logout gagal");
}
async function listUsers() {
  const response = await fetch("/api/database?action=users");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat user");
  return data.users;
}
async function createUser(payload) {
  const data = await postJson("/api/database", { action: "create-user", payload }, "Gagal membuat user");
  return data.user;
}
async function createUsersBatch(payload) {
  const data = await postJson("/api/database", { action: "create-users-batch", payload }, "Gagal membuat user batch");
  return data;
}
async function updateUser(userId, payload) {
  const data = await postJson("/api/database", { action: "update-user", id: userId, payload }, "Gagal mengubah user");
  return data.user;
}
async function deleteUser(userId) {
  return postJson("/api/database", { action: "delete-user", id: userId }, "Gagal menghapus user");
}
async function loadStateFromDatabase() {
  const response = await fetch("/api/state", { credentials: "include" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat data dari database");
  return {
    assessments: Array.isArray(data.assessments) ? data.assessments : [],
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    classes: Array.isArray(data.classes) ? data.classes : [],
    memberships: Array.isArray(data.memberships) ? data.memberships : []
  };
}
async function getSubmissionDetail(submissionId) {
  const response = await fetch(
    `/api/database?action=submission&id=${encodeURIComponent(submissionId)}`,
    { credentials: "include" }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat detail submission");
  return data.submission;
}
async function saveAssessmentToDatabase(assessment) {
  await postJson("/api/database", { action: "save-assessment", payload: assessment }, "Gagal menyimpan penilaian");
}
async function saveSubmissionToDatabase(submission) {
  await postJson("/api/database", { action: "save-submission", payload: submission }, "Gagal menyimpan submission");
}
async function submitComplaint(submissionId, questionIndex, reason) {
  return postJson(
    "/api/database",
    { action: "submit-complaint", payload: { submissionId, questionIndex, reason } },
    "Gagal mengirim komplain"
  );
}
async function seedDemoData(target) {
  return postJson(
    "/api/database",
    { action: "seed-demo", payload: { target } },
    "Gagal mengisi data contoh"
  );
}
async function removeDemoData() {
  return postJson(
    "/api/database",
    { action: "remove-demo-data" },
    "Gagal menghapus data dummy"
  );
}
async function streamAssessmentAction({ action, payload, onChunk, onResult, onError }) {
  const headers = { "Content-Type": "application/json" };
  if (clientCsrfToken) {
    headers["X-CSRF-Token"] = clientCsrfToken;
  }
  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ action, payload, stream: true })
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
      const dataLine = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
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
async function createClassroom(name) {
  const data = await postJson("/api/database", { action: "create-class", payload: { name } }, "Gagal membuat kelas");
  return data.class;
}
async function updateClassroom(classId, payload) {
  const data = await postJson("/api/database", { action: "update-class", id: classId, payload }, "Gagal mengubah kelas");
  return data.class;
}
async function deleteClassroom(classId) {
  return postJson("/api/database", { action: "delete-class", id: classId }, "Gagal menghapus kelas");
}
async function joinClass(joinCode) {
  const data = await postJson("/api/database", { action: "join-class", payload: { joinCode } }, "Gagal join kelas");
  return data.class;
}
async function addStudentsToClass(payload) {
  const data = await postJson("/api/database", { action: "add-students-to-class", payload }, "Gagal menambahkan siswa ke kelas");
  return data;
}
async function createStudentsBatch(payload) {
  const data = await postJson("/api/database", { action: "create-students-batch", payload }, "Gagal membuat siswa batch");
  return data;
}
async function approveJoinRequest(membershipId) {
  return postJson("/api/database", { action: "approve-membership", payload: { membershipId } }, "Gagal approve siswa");
}
async function updateMembership(membershipId, status) {
  return postJson("/api/database", { action: "update-membership", id: membershipId, payload: { status } }, "Gagal mengubah membership");
}
async function deleteMembership(membershipId) {
  return postJson("/api/database", { action: "delete-membership", id: membershipId }, "Gagal menghapus membership");
}
async function updateAssessment(assessmentId, payload) {
  const data = await postJson("/api/database", { action: "update-assessment", id: assessmentId, payload }, "Gagal mengubah penilaian");
  return data.assessment;
}
async function deleteAssessment(assessmentId) {
  return postJson("/api/database", { action: "delete-assessment", id: assessmentId }, "Gagal menghapus penilaian");
}
async function getSimulationData() {
  const response = await fetch("/api/auth?action=simulation");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat data simulasi");
  return data;
}
async function simulateLogin(userId) {
  return postJson("/api/auth", { action: "simulate-login", payload: { userId } }, "Gagal simulasi login");
}
async function saveQuestionToBank(question) {
  const data = await postJson("/api/database", { action: "save-question-bank", payload: question }, "Gagal menyimpan soal");
  return data.id;
}
async function listQuestionBank(filter) {
  const data = await postJson("/api/database", { action: "list-question-bank", payload: filter || {} }, "Gagal memuat bank soal");
  return data.questions;
}
async function deleteQuestionFromBank(questionId) {
  return postJson("/api/database", { action: "delete-question-bank", id: questionId }, "Gagal menghapus soal");
}
var clientCsrfToken;
var init_api = __esm({
  "src/js/api.js"() {
    clientCsrfToken = null;
  }
});

// src/js/dom.js
var dom_exports = {};
__export(dom_exports, {
  getElements: () => getElements,
  setButtonLoading: () => setButtonLoading,
  showEmpty: () => showEmpty
});
function getElements() {
  return {
    mainNav: document.getElementById("mainNav"),
    views: document.querySelectorAll(".view"),
    authView: document.querySelector("#authView"),
    appShell: document.querySelector("#appShell"),
    registerModal: document.querySelector("#registerModal"),
    openRegisterModalBtn: document.querySelector("#openRegisterModalBtn"),
    closeRegisterModalBtn: document.querySelector("#closeRegisterModalBtn"),
    loginForm: document.querySelector("#loginForm"),
    loginEmail: document.querySelector("#loginEmail"),
    loginPassword: document.querySelector("#loginPassword"),
    registerForm: document.querySelector("#registerForm"),
    registerTenant: document.querySelector("#registerTenant"),
    registerName: document.querySelector("#registerName"),
    registerEmail: document.querySelector("#registerEmail"),
    registerPassword: document.querySelector("#registerPassword"),
    logoutButton: document.querySelector("#logoutButton"),
    accountName: document.querySelector("#accountName"),
    tenantName: document.querySelector("#tenantName"),
    accountRole: document.querySelector("#accountRole"),
    adminNav: document.querySelector("#adminNav"),
    accountView: document.querySelector("#accountView"),
    userForm: document.querySelector("#userForm"),
    csvForm: document.querySelector("#csvForm"),
    csvFile: document.querySelector("#csvFile"),
    userName: document.querySelector("#userName"),
    userEmail: document.querySelector("#userEmail"),
    userPassword: document.querySelector("#userPassword"),
    userRole: document.querySelector("#userRole"),
    userList: document.querySelector("#userList"),
    selectAllUsers: document.querySelector("#selectAllUsers"),
    deleteSelectedUsers: document.querySelector("#deleteSelectedUsers"),
    form: document.querySelector("#assessmentForm"),
    createManualAssessment: document.querySelector("#createManualAssessment"),
    aiStreamPanel: document.querySelector("#aiStreamPanel"),
    aiStreamTitle: document.querySelector("#aiStreamTitle"),
    aiStreamPlaceholder: document.querySelector("#aiStreamPlaceholder"),
    aiStreamQuestions: document.querySelector("#aiStreamQuestions"),
    recommendStreamPanel: document.querySelector("#recommendStreamPanel"),
    recommendStreamTitle: document.querySelector("#recommendStreamTitle"),
    recommendStreamPlaceholder: document.querySelector("#recommendStreamPlaceholder"),
    recommendStreamContent: document.querySelector("#recommendStreamContent"),
    evaluationStreamContent: document.querySelector("#evaluationStreamContent"),
    evaluationProgressText: document.querySelector("#evaluationProgressText"),
    evaluationPreviewList: document.querySelector("#evaluationPreviewList"),
    assessmentList: document.querySelector("#assessmentList"),
    assessmentCount: document.querySelector("#assessmentCount"),
    studentSelect: document.querySelector("#studentAssessmentSelect"),
    studentDashboard: document.querySelector("#studentDashboard"),
    studentAssessmentGrid: document.querySelector("#studentAssessmentGrid"),
    studentClassFilter: document.querySelector("#studentClassFilter"),
    monitorClassFilter: document.querySelector("#monitorClassFilter"),
    monitorRangeFilter: document.querySelector("#monitorRangeFilter"),
    trendAssessmentCount: document.querySelector("#trendAssessmentCount"),
    downloadClassCsvBtn: document.getElementById("downloadClassCsvBtn"),
    backToDashboard: document.querySelector("#backToDashboard"),
    studentEmpty: document.querySelector("#studentEmpty"),
    studentWorkspace: document.querySelector("#studentWorkspace"),
    questionProgress: document.querySelector("#questionProgress"),
    activeDifficulty: document.querySelector("#activeDifficulty"),
    activeQuestion: document.querySelector("#activeQuestion"),
    activeHint: document.querySelector("#activeHint"),
    activeOutcome: document.querySelector("#activeOutcome"),
    activeRubric: document.querySelector("#activeRubric"),
    recordButton: document.querySelector("#recordButton"),
    recorderPanel: document.querySelector("#recorderPanel"),
    recordStatus: document.querySelector("#recordStatus"),
    recordTimer: document.querySelector("#recordTimer"),
    volumeIndicator: document.querySelector("#volumeIndicator"),
    testMicButton: document.querySelector("#testMicButton"),
    micStatus: document.querySelector("#micStatus"),
    micDiagnostics: document.querySelector("#micDiagnostics"),
    answerText: document.querySelector("#answerText"),
    prevQuestion: document.querySelector("#prevQuestion"),
    saveAnswer: document.querySelector("#saveAnswer"),
    answerMap: document.querySelector("#answerMap"),
    studentName: document.querySelector("#studentName"),
    finishAssessment: document.querySelector("#finishAssessment"),
    resultPanel: document.querySelector("#resultPanel"),
    evaluationLoadingModal: document.querySelector("#evaluationLoadingModal"),
    preExamModal: document.querySelector("#preExamModal"),
    preExamTitle: document.querySelector("#preExamTitle"),
    preExamMeta: document.querySelector("#preExamMeta"),
    preExamMicSection: document.querySelector("#preExamMicSection"),
    preExamMicTest: document.querySelector("#preExamMicTest"),
    preExamVolume: document.querySelector("#preExamVolume"),
    preExamMicStatus: document.querySelector("#preExamMicStatus"),
    preExamPlayback: document.querySelector("#preExamPlayback"),
    preExamMicDiagnostics: document.querySelector("#preExamMicDiagnostics"),
    preExamStartNote: document.querySelector("#preExamStartNote"),
    preExamStart: document.querySelector("#preExamStart"),
    preExamCancel: document.querySelector("#preExamCancel"),
    preExamClose: document.querySelector("#preExamClose"),
    submissionCount: document.querySelector("#submissionCount"),
    submissionList: document.querySelector("#submissionList"),
    studentHistoryList: document.querySelector("#studentHistoryList"),
    classAverage: document.querySelector("#classAverage"),
    trendList: document.querySelector("#trendList"),
    seedDemo: document.querySelector("#seedDemo"),
    seedDemoTeacher: document.querySelector("#seedDemoTeacher"),
    seedDemoAdmin: document.querySelector("#seedDemoAdmin"),
    removeDemoData: document.querySelector("#removeDemoData"),
    recommendOutcomes: document.querySelector("#recommendOutcomes"),
    topic: document.querySelector("#topic"),
    outcomes: document.querySelector("#outcomes"),
    difficulty: document.querySelector("#difficulty"),
    timeLimit: document.querySelector("#timeLimit"),
    timerDisplay: document.querySelector("#timerDisplay"),
    examples: document.querySelector("#examples"),
    questionCount: document.querySelector("#questionCount"),
    classSelect: document.querySelector("#classSelect"),
    classPanel: document.querySelector("#classPanel"),
    classForm: document.querySelector("#classForm"),
    classNameInput: document.querySelector("#className"),
    classList: document.querySelector("#classList"),
    bulkAddClassSelect: document.querySelector("#bulkAddClassSelect"),
    bulkAddEmails: document.querySelector("#bulkAddEmails"),
    bulkAddButton: document.querySelector("#bulkAddButton"),
    bulkAddClear: document.querySelector("#bulkAddClear"),
    bulkAddCsvFile: document.querySelector("#bulkAddCsvFile"),
    bulkAddCsvUpload: document.querySelector("#bulkAddCsvUpload"),
    bulkAddCsvTemplate: document.querySelector("#bulkAddCsvTemplate"),
    joinClassForm: document.querySelector("#joinClassForm"),
    joinCode: document.querySelector("#joinCode"),
    pendingJoinList: document.querySelector("#pendingJoinList"),
    approvedMemberList: document.querySelector("#approvedMemberList"),
    memberSearchInput: document.querySelector("#memberSearchInput"),
    memberPaginationContainer: document.querySelector("#memberPaginationContainer"),
    memberPrevBtn: document.querySelector("#memberPrevBtn"),
    memberNextBtn: document.querySelector("#memberNextBtn"),
    memberPageInfo: document.querySelector("#memberPageInfo"),
    memberCountText: document.querySelector("#memberCountText"),
    studentJoinClassForm: document.querySelector("#studentJoinClassForm"),
    studentJoinCode: document.querySelector("#studentJoinCode"),
    studentClassList: document.querySelector("#studentClassList"),
    questionEditor: document.querySelector("#questionEditor"),
    editableQuestionList: document.querySelector("#editableQuestionList"),
    addManualQuestion: document.querySelector("#addManualQuestion"),
    saveQuestionSet: document.querySelector("#saveQuestionSet"),
    improveQuestionSet: document.querySelector("#improveQuestionSet"),
    wizardSteps: document.querySelectorAll(".wizard-step"),
    wizardPanels: document.querySelectorAll(".wizard-panel"),
    wizardToQuestions: document.querySelector("#wizardToQuestions"),
    wizardBackToContext: document.querySelector("#wizardBackToContext"),
    wizardToReview: document.querySelector("#wizardToReview"),
    wizardBackToQuestions: document.querySelector("#wizardBackToQuestions"),
    reviewSummary: document.querySelector("#reviewSummary"),
    simulatorWidget: document.querySelector("#simulatorWidget"),
    simulatorToggle: document.querySelector("#simulatorToggle"),
    simulatorPanel: document.querySelector("#simulatorPanel"),
    simulatorClose: document.querySelector("#simulatorClose"),
    simulatorTenantList: document.querySelector("#simulatorTenantList"),
    disableManualTyping: document.querySelector("#disableManualTyping"),
    oralExamEnabled: document.querySelector("#oralExamEnabled"),
    editDisableManualTyping: document.querySelector("#editDisableManualTyping"),
    editOralExamEnabled: document.querySelector("#editOralExamEnabled"),
    allowRetakes: document.querySelector("#allowRetakes"),
    editAllowRetakes: document.querySelector("#editAllowRetakes"),
    maxAttempts: document.querySelector("#maxAttempts"),
    recordInstructions: document.querySelector("#recordInstructions"),
    observabilityView: document.querySelector("#observabilityView"),
    telemetryRange: document.querySelector("#telemetryRange"),
    telemetryLastUpdated: document.querySelector("#telemetryLastUpdated"),
    telemetryTotalCalls: document.querySelector("#telemetryTotalCalls"),
    telemetryCallsDelta: document.querySelector("#telemetryCallsDelta"),
    telemetryErrorRate: document.querySelector("#telemetryErrorRate"),
    telemetryErrorHealth: document.querySelector("#telemetryErrorHealth"),
    telemetryP50: document.querySelector("#telemetryP50"),
    telemetryP95: document.querySelector("#telemetryP95"),
    telemetryP95Health: document.querySelector("#telemetryP95Health"),
    telemetryTailAlert: document.querySelector("#telemetryTailAlert"),
    telemetryLatencyDist: document.querySelector("#telemetryLatencyDist"),
    telemetryPercentileTable: document.querySelector("#telemetryPercentileTable"),
    telemetryTailRatio: document.querySelector("#telemetryTailRatio"),
    telemetryLatencyByOp: document.querySelector("#telemetryLatencyByOp"),
    telemetryTokens: document.querySelector("#telemetryTokens"),
    telemetryTokenSplit: document.querySelector("#telemetryTokenSplit"),
    telemetryAvgTokens: document.querySelector("#telemetryAvgTokens"),
    telemetryAvgPrompt: document.querySelector("#telemetryAvgPrompt"),
    telemetryAvgCompletion: document.querySelector("#telemetryAvgCompletion"),
    telemetryTokensPerCall: document.querySelector("#telemetryTokensPerCall"),
    telemetryTokensPerEval: document.querySelector("#telemetryTokensPerEval"),
    telemetryCost: document.querySelector("#telemetryCost"),
    telemetryCostPerEval: document.querySelector("#telemetryCostPerEval"),
    telemetryCostPer1K: document.querySelector("#telemetryCostPer1K"),
    telemetryCostByOp: document.querySelector("#telemetryCostByOp"),
    telemetryPrefixTokens: document.querySelector("#telemetryPrefixTokens"),
    telemetryPrefixPct: document.querySelector("#telemetryPrefixPct"),
    telemetryPrefixCost: document.querySelector("#telemetryPrefixCost"),
    telemetryCacheHits: document.querySelector("#telemetryCacheHits"),
    telemetryCacheMisses: document.querySelector("#telemetryCacheMisses"),
    telemetryKvStatus: document.querySelector("#telemetryKvStatus"),
    telemetryProviderTable: document.querySelector("#telemetryProviderTable"),
    telemetrySlowestCalls: document.querySelector("#telemetrySlowestCalls"),
    telemetryLogList: document.querySelector("#telemetryLogList"),
    telemetryFilterOp: document.querySelector("#telemetryFilterOp"),
    telemetryFilterModel: document.querySelector("#telemetryFilterModel"),
    telemetryFilterStatus: document.querySelector("#telemetryFilterStatus"),
    telemetryFilterLatency: document.querySelector("#telemetryFilterLatency"),
    telemetryFilterDate: document.querySelector("#telemetryFilterDate"),
    telemetryLogCount: document.querySelector("#telemetryLogCount"),
    telemetryLogPagination: document.querySelector("#telemetryLogPagination"),
    telemetryLogPrev: document.querySelector("#telemetryLogPrev"),
    telemetryLogNext: document.querySelector("#telemetryLogNext"),
    telemetryLogPageInfo: document.querySelector("#telemetryLogPageInfo"),
    sysHealthList: document.querySelector("#sysHealthList"),
    telemetryRestartAlert: document.querySelector("#telemetryRestartAlert"),
    sysMemoryHeap: document.querySelector("#sysMemoryHeap"),
    sysMemoryTotal: document.querySelector("#sysMemoryTotal"),
    sysCpuUsage: document.querySelector("#sysCpuUsage"),
    sysCpuSystem: document.querySelector("#sysCpuSystem"),
    sysUptime: document.querySelector("#sysUptime"),
    sysNodeVersion: document.querySelector("#sysNodeVersion"),
    refreshTelemetryBtn: document.querySelector("#refreshTelemetryBtn"),
    complaintView: document.querySelector("#complaintView"),
    complaintList: document.querySelector("#complaintList"),
    complaintCount: document.querySelector("#complaintCount"),
    complaintNavBadge: document.querySelector("#complaintNavBadge"),
    complaintNotification: document.querySelector("#complaintNotification"),
    studentNotifView: document.querySelector("#studentNotifView"),
    studentNotifList: document.querySelector("#studentNotifList"),
    researchView: document.querySelector("#researchView"),
    researchSelect: document.querySelector("#researchSelect"),
    researchValidity: document.querySelector("#researchValidity"),
    researchInterRater: document.querySelector("#researchInterRater"),
    researchRunsList: document.querySelector("#researchRunsList"),
    researchRubricPanel: document.querySelector("#researchRubricPanel"),
    researchResultPanel: document.querySelector("#researchResultPanel"),
    researchExportBtn: document.querySelector("#researchExportBtn"),
    refreshResearchBtn: document.querySelector("#refreshResearchBtn"),
    apiKeyName: document.querySelector("#apiKeyName"),
    createApiKeyBtn: document.querySelector("#createApiKeyBtn"),
    apiKeyResult: document.querySelector("#apiKeyResult"),
    apiKeyValue: document.querySelector("#apiKeyValue"),
    apiKeyList: document.querySelector("#apiKeyList"),
    apiKeysView: document.querySelector("#apiKeysView"),
    // Trustworthy assessment dashboard (PRD UX v1.0)
    dashboardView: document.querySelector("#dashboardView"),
    dashboardSubtitle: document.querySelector("#dashboardSubtitle"),
    dashboardClassFilter: document.querySelector("#dashboardClassFilter"),
    dashboardRangeFilter: document.querySelector("#dashboardRangeFilter"),
    dashboardKpis: document.querySelector("#dashboardKpis"),
    performanceChart: document.querySelector("#performanceChart"),
    scoreDistribution: document.querySelector("#scoreDistribution"),
    competencyOverview: document.querySelector("#competencyOverview"),
    atRiskList: document.querySelector("#atRiskList"),
    atRiskCount: document.querySelector("#atRiskCount"),
    recentAssessmentsList: document.querySelector("#recentAssessmentsList"),
    assessmentListView: document.querySelector("#assessmentListView"),
    assessmentTabFilter: document.querySelector("#assessmentTabFilter"),
    assessmentDetailView: document.querySelector("#assessmentDetailView"),
    detailBackBtn: document.querySelector("#detailBackBtn"),
    assessmentDetailContent: document.querySelector("#assessmentDetailContent"),
    studentProfileView: document.querySelector("#studentProfileView"),
    profileStudentSelect: document.querySelector("#profileStudentSelect"),
    studentProfileContent: document.querySelector("#studentProfileContent"),
    questionBankView: document.querySelector("#questionBankView"),
    questionBankList: document.querySelector("#questionBankList"),
    questionBankCount: document.querySelector("#questionBankCount"),
    questionBankFilter: document.querySelector("#questionBankFilter"),
    questionBankImportBtn: document.querySelector("#questionBankImportBtn"),
    saveToBankBtn: document.querySelector("#saveToBankBtn"),
    isTryout: document.querySelector("#isTryout"),
    editIsTryout: document.querySelector("#editIsTryout"),
    notifBadge: document.querySelector("#notifBadge"),
    notifList: document.querySelector("#notifList"),
    notifView: document.querySelector("#notifView"),
    compTrendChart: document.querySelector("#compTrendChart"),
    compTrendLegend: document.querySelector("#compTrendLegend"),
    darkModeToggle: document.querySelector("#darkModeToggle"),
    hamburgerBtn: document.querySelector("#hamburgerBtn")
  };
}
function setButtonLoading(button, loading, loadingText, defaultText) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.setAttribute("aria-busy", String(loading));
  button.textContent = loading ? loadingText : defaultText;
}
function showEmpty(container, className, message) {
  container.className = className;
  container.setAttribute("role", "status");
  container.innerHTML = `
    <span class="empty-state-icon" aria-hidden="true">\u25CB</span>
    <div>
      <strong>Belum ada data</strong>
      <p>${message}</p>
    </div>
  `;
}
var init_dom = __esm({
  "src/js/dom.js"() {
  }
});

// src/js/session.js
function createSession(state) {
  return {
    currentAssessmentId: null,
    currentQuestionIndex: 0,
    currentAnswers: [],
    getCurrentAssessment() {
      return state.assessments.find((assessment) => assessment.id === this.currentAssessmentId);
    },
    ensureAssessmentSelected() {
      if (!state.assessments.length) {
        this.currentAssessmentId = null;
        this.currentAnswers = [];
        this.currentQuestionIndex = 0;
        return;
      }
      const existing = state.assessments.some((assessment) => assessment.id === this.currentAssessmentId);
      if (!existing) this.selectAssessment(state.assessments[0].id);
    },
    selectAssessment(assessmentId) {
      const assessment = state.assessments.find((item) => item.id === assessmentId);
      this.currentAssessmentId = assessmentId;
      this.currentAnswers = Array(assessment?.questions.length || 0).fill(null).map(() => ({
        text: "",
        audio: null,
        duration: 0,
        timeLeft: assessment?.timeLimit || 0
      }));
      this.currentQuestionIndex = 0;
    },
    saveAnswer(answer, audioBase64 = null, elapsedSeconds = 0) {
      if (!this.currentAnswers[this.currentQuestionIndex]) {
        this.currentAnswers[this.currentQuestionIndex] = { text: "", audio: null, duration: 0 };
      }
      this.currentAnswers[this.currentQuestionIndex].text = (answer || "").trim();
      if (audioBase64) {
        this.currentAnswers[this.currentQuestionIndex].audio = audioBase64;
      }
      this.currentAnswers[this.currentQuestionIndex].duration = (this.currentAnswers[this.currentQuestionIndex].duration || 0) + elapsedSeconds;
    },
    goPrevious() {
      this.currentQuestionIndex = Math.max(0, this.currentQuestionIndex - 1);
    },
    goNext() {
      const assessment = this.getCurrentAssessment();
      if (!assessment) return;
      this.currentQuestionIndex = Math.min(assessment.questions.length - 1, this.currentQuestionIndex + 1);
    }
  };
}
var init_session = __esm({
  "src/js/session.js"() {
  }
});

// src/js/recorder.js
function createRecorder({ recordButton, recordStatus, answerText, recordTimer, volumeIndicator }) {
  let mediaRecorder = null;
  let recognition = null;
  let mediaStream = null;
  let audioChunks = [];
  let recognizing = false;
  let transcriptDraft = "";
  let runId = 0;
  let enabled = true;
  let timerInterval = null;
  let recordingStartedAt = 0;
  let audioContext = null;
  let analyser = null;
  let volumeRaf = null;
  if (recordButton && typeof recordButton.addEventListener === "function") {
    recordButton.addEventListener("click", (event) => {
      event.preventDefault();
      toggle();
    });
  }
  async function start() {
    if (!enabled) return;
    if (isRecording()) return;
    const activeRunId = runId + 1;
    runId = activeRunId;
    setPreparing(true);
    try {
      mediaStream = await requestMicrophone();
      if (activeRunId !== runId) {
        stopStream();
        return;
      }
      startMediaRecorder("Merekam audio...", activeRunId);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        startSpeechRecognition(SpeechRecognition, activeRunId);
      }
    } catch (err) {
      recordStatus.textContent = err.message;
      setRecording(false);
      throw err;
    } finally {
      setPreparing(false);
    }
  }
  async function toggle() {
    if (isRecording()) {
      stop();
    } else {
      await start();
    }
  }
  function stop() {
    runId += 1;
    if (recognition && recognizing) recognition.stop();
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    recognizing = false;
    transcriptDraft = "";
    setRecording(false);
  }
  function isRecording() {
    return recognizing || mediaRecorder?.state === "recording";
  }
  async function requestMicrophone() {
    if (!window.isSecureContext) {
      throw new Error("Mikrofon hanya bisa dipakai di HTTPS atau localhost.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser tidak mendukung akses mikrofon. Ketik jawaban manual.");
    }
    recordStatus.textContent = "Meminta izin mikrofon...";
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (error) {
      throw new Error(getMicrophoneErrorMessage(error));
    }
  }
  function currentAnswerText() {
    return (typeof answerText === "string" ? document.querySelector(answerText) : answerText && answerText.isConnected ? answerText : document.querySelector("#answerText")) || null;
  }
  function startSpeechRecognition(SpeechRecognition, activeRunId) {
    transcriptDraft = (currentAnswerText()?.value || "").trim();
    recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      if (activeRunId !== runId) return;
      recognizing = true;
      recordStatus.textContent = "Merekam suara dan membuat transkripsi...";
    };
    recognition.onresult = (event) => {
      if (activeRunId !== runId) return;
      const { finalText, interimText } = collectSpeechText(event);
      if (finalText) transcriptDraft = [transcriptDraft, finalText].filter(Boolean).join(" ");
      const target = currentAnswerText();
      if (target) target.value = [transcriptDraft, interimText].filter(Boolean).join(" ");
    };
    recognition.onerror = (event) => {
      if (activeRunId !== runId) return;
      console.warn("Speech recognition error:", event.error);
      recognizing = false;
      if (["no-speech", "aborted", "network", "audio-capture"].includes(event.error)) {
        restartRecognition(activeRunId);
      }
    };
    recognition.onend = () => {
      if (activeRunId !== runId) return;
      recognizing = false;
      if (stillRecording()) restartRecognition(activeRunId);
    };
    try {
      recognition.start();
    } catch (error) {
      recognizing = false;
      console.warn("Transkripsi tidak bisa dimulai:", error.message);
      restartRecognition(activeRunId);
    }
  }
  let restartTimer = null;
  function restartRecognition(activeRunId) {
    if (activeRunId !== runId) return;
    if (!stillRecording()) return;
    if (restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (activeRunId !== runId || !stillRecording()) return;
      if (!recognition || recognizing) return;
      try {
        recognition.start();
      } catch (error) {
        console.warn("Transkripsi restart gagal:", error.message);
      }
    }, 500);
  }
  function stillRecording() {
    return mediaRecorder?.state === "recording";
  }
  function startMediaRecorder(status, activeRunId) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => {
      if (activeRunId !== runId) return;
      if (event.data.size) audioChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      if (activeRunId !== runId) return;
      stopStream();
      stopTimer();
      stopVolumeMeter();
      const target = currentAnswerText();
      recordStatus.textContent = audioChunks.length ? target?.readOnly ? "Audio berhasil direkam. Jawaban hanya menggunakan transkripsi otomatis." : "Audio berhasil direkam. Ketik atau koreksi transkripsi agar bisa dinilai." : "Rekaman berhenti, tetapi tidak ada audio yang tersimpan.";
    };
    mediaRecorder.start();
    setRecording(true);
    recordStatus.textContent = status;
    startTimer();
    startVolumeMeter();
  }
  function collectSpeechText(event) {
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) {
        finalText = [finalText, transcript].filter(Boolean).join(" ");
      } else {
        interimText = [interimText, transcript].filter(Boolean).join(" ");
      }
    }
    return { finalText, interimText };
  }
  function setPreparing(preparing) {
    recordButton.disabled = preparing;
    recordButton.setAttribute("aria-label", preparing ? "Menyiapkan mikrofon..." : "Mulai rekam");
  }
  function setRecording(recording) {
    recordButton.classList.toggle("recording", recording);
    recordButton.setAttribute("aria-label", recording ? "Berhenti rekam" : "Mulai rekam");
    const label = recordButton.querySelector(".record-label");
    if (label) label.textContent = recording ? "Berhenti" : "Mulai rekam";
  }
  function resetStatus() {
    if (isRecording()) return;
    recordStatus.textContent = "Siap merekam";
    resetTimer();
    resetVolumeMeter();
  }
  function startTimer() {
    stopTimer();
    recordingStartedAt = Date.now();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1e3);
  }
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  function updateTimerDisplay() {
    if (!recordTimer) return;
    const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1e3);
    const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const s = (elapsed % 60).toString().padStart(2, "0");
    recordTimer.textContent = `${m}:${s}`;
  }
  function resetTimer() {
    stopTimer();
    if (recordTimer) recordTimer.textContent = "00:00";
  }
  function startVolumeMeter() {
    stopVolumeMeter();
    if (!volumeIndicator) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const bars = volumeIndicator.querySelectorAll(".volume-bar");
      const tick = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const level = Math.min(1, avg / 128);
        const activeBars = Math.round(level * bars.length);
        bars.forEach((bar, index) => {
          bar.classList.toggle("active", index < activeBars);
        });
        volumeRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch (error) {
      console.warn("Volume meter tidak tersedia:", error.message);
    }
  }
  function stopVolumeMeter() {
    if (volumeRaf) {
      cancelAnimationFrame(volumeRaf);
      volumeRaf = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {
      });
      audioContext = null;
      analyser = null;
    }
    resetVolumeMeter();
  }
  function resetVolumeMeter() {
    if (!volumeIndicator) return;
    volumeIndicator.querySelectorAll(".volume-bar").forEach((bar) => bar.classList.remove("active"));
  }
  function stopStream() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  function getAudioBase64() {
    if (audioChunks.length === 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }
  function clearAudio() {
    audioChunks = [];
  }
  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    if (!enabled) {
      stop();
      clearAudio();
    }
  }
  async function testMicrophone() {
    if (isRecording()) {
      return { ok: false, message: "Rekaman sedang berjalan. Hentikan dulu sebelum tes mikrofon." };
    }
    if (!window.isSecureContext) {
      return { ok: false, message: "Mikrofon hanya bisa dipakai di HTTPS atau localhost." };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, message: "Browser tidak mendukung akses mikrofon. Ketik jawaban manual." };
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        return { ok: false, message: "Mikrofon terdeteksi tetapi tidak ada track audio aktif." };
      }
      const label = tracks[0].label || "Mikrofon bawaan";
      const enabled2 = tracks[0].enabled;
      return { ok: true, message: `Mikrofon siap: ${label}`, label, enabled: enabled2 };
    } catch (error) {
      return { ok: false, message: getMicrophoneErrorMessage(error), name: error?.name || "" };
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    }
  }
  return { resetStatus, stop, start, toggle, getAudioBase64, clearAudio, setEnabled, testMicrophone };
}
function getMicrophoneErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin mikrofon diblokir. Klik ikon izin di address bar, pilih Allow microphone, lalu reload halaman.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Mikrofon tidak ditemukan. Sambungkan mikrofon atau pilih input audio di pengaturan browser.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Mikrofon sedang dipakai aplikasi lain atau tidak bisa dibaca.";
  }
  if (name === "OverconstrainedError") {
    return "Konfigurasi mikrofon tidak cocok.";
  }
  return error?.message || "Mikrofon belum bisa digunakan.";
}
var init_recorder = __esm({
  "src/js/recorder.js"() {
  }
});

// src/js/config.js
var DEFAULT_STATE, DEFAULT_QUESTION_COUNT, FALLBACK_KEYWORDS, STOPWORDS, FALLBACK_QUESTION_STEMS;
var init_config = __esm({
  "src/js/config.js"() {
    DEFAULT_STATE = {
      assessments: [],
      submissions: [],
      classes: [],
      memberships: []
    };
    DEFAULT_QUESTION_COUNT = 5;
    FALLBACK_KEYWORDS = ["konsep", "alasan", "contoh", "hubungan"];
    STOPWORDS = /* @__PURE__ */ new Set([
      "yang",
      "dan",
      "atau",
      "untuk",
      "dengan",
      "dalam",
      "pada",
      "dari",
      "ke",
      "di",
      "sebagai",
      "adalah",
      "serta",
      "siswa",
      "mampu",
      "dapat",
      "secara",
      "contoh",
      "rubrik",
      "penilaian",
      "materi",
      "topik",
      "kompetensi",
      "jawaban"
    ]);
    FALLBACK_QUESTION_STEMS = {
      Dasar: [
        "Jelaskan pengertian utama dari {topic} dengan bahasa sendiri.",
        "Sebutkan dua konsep penting dalam {topic} dan jelaskan hubungannya.",
        "Berikan contoh sederhana yang menunjukkan pemahamanmu tentang {keyword}.",
        "Apa bagian dari {topic} yang paling mudah keliru dipahami? Jelaskan."
      ],
      Menengah: [
        "Jelaskan {topic} dengan mengaitkan konsep {keyword} dan alasan pendukungnya.",
        "Bandingkan dua ide penting dalam {topic}, lalu jelaskan mana yang paling menentukan.",
        "Gunakan contoh konkret untuk membuktikan bahwa kamu memahami {keyword}.",
        "Jika ada teman yang salah memahami {topic}, bagaimana kamu memperbaiki penjelasannya?",
        "Apa konsekuensi dari konsep {keyword} terhadap penerapan {topic}?"
      ],
      Lanjutan: [
        "Analisis keterkaitan {topic}, {keyword}, dan indikator kompetensi yang diuji.",
        "Evaluasi sebuah situasi nyata yang berkaitan dengan {topic}, lalu berikan argumenmu.",
        "Bangun penjelasan bertahap tentang {keyword} beserta keterbatasan contohnya.",
        "Ajukan kesimpulan tentang {topic} dan pertahankan dengan bukti konseptual.",
        "Sintesis beberapa konsep dalam {topic} menjadi penjelasan yang utuh dan kritis."
      ]
    };
  }
});

// src/js/storage.js
var storage_exports = {};
__export(storage_exports, {
  loadState: () => loadState
});
async function loadState() {
  try {
    const state = await loadStateFromDatabase();
    if (!state.assessments.length && !state.submissions.length) {
      return await migrateLegacyLocalStorage(state);
    }
    return state;
  } catch (error) {
    alert(`Database belum bisa dimuat. Aplikasi memakai state kosong. Detail: ${error.message}`);
    return structuredClone(DEFAULT_STATE);
  }
}
async function migrateLegacyLocalStorage(currentState) {
  const legacy = readLegacyState();
  if (!legacy.assessments.length && !legacy.submissions.length) return currentState;
  await Promise.all(legacy.assessments.map(saveAssessmentToDatabase));
  await Promise.all(legacy.submissions.map(saveSubmissionToDatabase));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return legacy;
}
function readLegacyState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    return {
      assessments: Array.isArray(parsed?.assessments) ? parsed.assessments : [],
      submissions: Array.isArray(parsed?.submissions) ? parsed.submissions : []
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}
var LEGACY_STORAGE_KEY;
var init_storage = __esm({
  "src/js/storage.js"() {
    init_config();
    init_api();
    LEGACY_STORAGE_KEY = "lisanai-assessment-state";
  }
});

// src/js/utils.js
function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function compactText(value, max = 130) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function getKeywords(...values) {
  const words = values.join(" ").toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s]/gi, " ").split(/\s+/).filter((word) => word.length > 4 && !STOPWORDS.has(word));
  return [...new Set(words)].slice(0, 12);
}
function average(items, picker) {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + picker(item), 0) / items.length);
}
function roleLabel(role) {
  return {
    admin: "Admin",
    teacher: "Guru",
    student: "Siswa"
  }[role] || role;
}
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function prettifyId(id) {
  return String(id || "").replace(/[_-]+/g, " ").replace(/\b\d{2,3}\b/g, "").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
var init_utils = __esm({
  "src/js/utils.js"() {
    init_config();
  }
});

// src/js/competency-profile.js
function normalize(v) {
  return String(v == null ? "" : v).trim().toLowerCase();
}
function normalizeOutcome(v) {
  return normalize(v).replace(/[^a-z0-9\u00C0-\u024F]+/gi, " ").replace(/\s+/g, " ").trim();
}
function fillDescriptors(name, levels) {
  const base = name || "Kriteria";
  const templates = [
    `${base} sangat baik, lengkap, dan tepat`,
    `${base} baik dan memadai`,
    `${base} cukup, namun masih perlu pengembangan`,
    `${base} kurang, perlu perbaikan signifikan`
  ];
  return levels.map((l, i) => ({
    score: l.score,
    label: l.label || "",
    descriptor: l.descriptor || templates[i] || ""
  }));
}
function defaultCriteria() {
  return [{ id: "c1", name: "", weight: 0, levels: fillDescriptors("", JSON.parse(JSON.stringify(DEFAULT_LEVELS))) }];
}
function parseRubricToCriteria(text) {
  if (!text || !String(text).trim()) return defaultCriteria();
  const t = String(text).trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria) && p.criteria.length) {
        return p.criteria.map((c, i) => ({
          id: c.id || `c${i + 1}`,
          name: c.name || "",
          weight: Number(c.weight) || 0,
          levels: Array.isArray(c.levels) && c.levels.length === 4 ? fillDescriptors(c.name || "", c.levels.map((l) => ({ score: l.score, label: l.label, descriptor: l.descriptor }))) : fillDescriptors(c.name || "", JSON.parse(JSON.stringify(DEFAULT_LEVELS)))
        }));
      }
    } catch {
    }
  }
  const raw = t;
  const lines = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "(" || raw[i] === "[" || raw[i] === "{") depth++;
    else if (raw[i] === ")" || raw[i] === "]" || raw[i] === "}") depth--;
    else if (depth === 0 && (raw[i] === "," || raw[i] === ";" || raw[i] === "\n")) {
      const seg = raw.slice(start, i).trim();
      if (seg) lines.push(seg);
      start = i + 1;
    }
  }
  const last = raw.slice(start).trim();
  if (last) lines.push(last);
  if (!lines.length) lines.push("");
  return lines.map((line, i) => {
    let name = line.trim().replace(/^[•\-*]\s*/, "").replace(/[.!]+$/, "").trim();
    let weight = 0;
    let m = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (m) {
      name = m[1].trim();
      weight = Number(m[2]);
    } else {
      m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/);
      if (m) {
        weight = Number(m[1]);
        name = m[2].trim();
      }
    }
    return { id: `c${i + 1}`, name, weight, levels: fillDescriptors(name, JSON.parse(JSON.stringify(DEFAULT_LEVELS))) };
  });
}
function parseLearningOutcomes(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string") return { id: `LO${index + 1}`, text: item.trim() };
      return {
        id: String(item?.id || item?.learningOutcomeId || `LO${index + 1}`).trim(),
        text: String(item?.text || item?.name || item?.title || item?.outcome || "").trim()
      };
    }).filter((x) => x.text);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(/\r?\n|\s*;\s*/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const named = line.match(/^(?:[-*•]\s*)?(?:LO|CPL|CPMK|Learning Outcome)\s*[-#:.)]?\s*(\d+)\s*[-:.):]?\s*(.+)$/i);
    if (named) return { id: `LO${named[1]}`, text: named[2].trim() };
    const numbered = line.match(/^(?:[-*•]\s*)?(\d+)[.)]\s*(.+)$/);
    if (numbered) return { id: `LO${numbered[1]}`, text: numbered[2].trim() };
    return { id: `LO${index + 1}`, text: line };
  });
}
function resolveQuestionOutcome(question, outcomes) {
  const explicitId = String(question?.learningOutcomeId || question?.outcomeId || "").trim();
  if (explicitId) {
    const byId = outcomes.find((lo) => normalize(lo.id) === normalize(explicitId));
    if (byId) return byId;
  }
  const text = normalizeOutcome(question?.outcome || "");
  if (text) {
    const exact = outcomes.find((lo) => normalizeOutcome(lo.text) === text);
    if (exact) return exact;
    const contains = outcomes.find((lo) => {
      const a = normalizeOutcome(lo.text);
      return a && (a.includes(text) || text.includes(a));
    });
    if (contains) return contains;
  }
  return null;
}
function collectRubric(assessments, assessmentId) {
  const byId = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  const push = (defs) => (defs || []).forEach((d) => {
    if (!d || !d.name) return;
    if (!byId.has(String(d.id))) byId.set(String(d.id), d);
    if (!byName.has(normalize(d.name))) byName.set(normalize(d.name), d);
  });
  const assessment = (assessments || []).find((a) => a && (a.id === assessmentId || a.assessment_id === assessmentId));
  if (assessment) {
    if (assessment.rubric) push(parseRubricToCriteria(assessment.rubric));
    (assessment.questions || []).forEach((q) => {
      if (q?.rubric) push(parseRubricToCriteria(q.rubric));
    });
  }
  return { byId, byName, assessment };
}
function levelForScore(score, levels) {
  const list = Array.isArray(levels) && levels.length ? levels : DEFAULT_LEVELS;
  const max = Math.max(...list.map((l) => Number(l.score)));
  const target = Number(score) / 100 * max;
  let best = list[0];
  let bestDiff = Infinity;
  for (const l of list) {
    const diff = Math.abs(Number(l.score) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = l;
    }
  }
  return best;
}
function levelScore(score, levels) {
  const max = Math.max(...levels.map((l) => Number(l.score)));
  return Math.max(1, Math.min(max, Math.round(Number(score) / 100 * max)));
}
function buildCompetencyProfile(assessments, submissions) {
  const loMap = /* @__PURE__ */ new Map();
  const ensureLO = (lo, assessment) => {
    const key = lo.id;
    if (!loMap.has(key)) {
      loMap.set(key, {
        id: lo.id,
        name: lo.text,
        weight: 0,
        levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)),
        records: [],
        criteriaMap: /* @__PURE__ */ new Map(),
        assessmentIds: /* @__PURE__ */ new Set()
      });
    }
    const entry = loMap.get(key);
    if (assessment?.id) entry.assessmentIds.add(assessment.id);
    return entry;
  };
  (submissions || []).forEach((sub) => {
    const { byId, byName, assessment } = collectRubric(assessments, sub.assessmentId);
    const outcomes = parseLearningOutcomes(assessment?.outcomes);
    if (!assessment || !outcomes.length) return;
    const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
    const questionLO = /* @__PURE__ */ new Map();
    questions.forEach((q, index) => {
      const lo = resolveQuestionOutcome(q, outcomes);
      if (lo) questionLO.set(index, lo);
    });
    const studentBuckets = /* @__PURE__ */ new Map();
    (Array.isArray(sub.criteria) ? sub.criteria : []).forEach((c) => {
      if (!Number.isFinite(Number(c.score))) return;
      const def = byId.get(String(c.criterionId)) || byName.get(normalize(c.name));
      const criterionId = String(c.criterionId || def?.id || c.name || "").trim();
      let lo = Number.isInteger(c.answerIndex) ? questionLO.get(c.answerIndex) : null;
      if (!lo && criterionId) {
        const q = questions.find((item) => (item.criteria || []).some((x) => String(typeof x === "object" ? x.id || x.criterionId || x.name : x) === criterionId));
        if (q) lo = resolveQuestionOutcome(q, outcomes);
      }
      if (!lo) return;
      const entry = ensureLO(lo, assessment);
      const weight = Number(c.weight ?? def?.weight ?? 1);
      const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
      const score = Number(c.score);
      const bucketKey = `${sub.studentName || "student"}::${lo.id}::${sub.assessmentId || assessment.id}`;
      if (!studentBuckets.has(bucketKey)) studentBuckets.set(bucketKey, { lo, weighted: 0, weight: 0, studentName: sub.studentName });
      const bucket = studentBuckets.get(bucketKey);
      bucket.weighted += score * safeWeight;
      bucket.weight += safeWeight;
      const criterionName = def && def.name || c.name || prettifyId(c.criterionId) || "Kriteria";
      if (!entry.criteriaMap.has(criterionName)) entry.criteriaMap.set(criterionName, []);
      entry.criteriaMap.get(criterionName).push({ studentName: sub.studentName, score });
    });
    for (const bucket of studentBuckets.values()) {
      const entry = ensureLO(bucket.lo, assessment);
      entry.records.push({ studentName: bucket.studentName, score: bucket.weight ? bucket.weighted / bucket.weight : 0 });
    }
  });
  const out = [];
  for (const entry of loMap.values()) {
    if (!entry.records.length) continue;
    const avg = entry.records.reduce((sum, r) => sum + r.score, 0) / entry.records.length;
    const criteria = [...entry.criteriaMap.entries()].map(([name, records]) => ({
      name,
      records,
      avg: records.reduce((sum, r) => sum + r.score, 0) / records.length
    })).sort((a, b) => b.avg - a.avg);
    const levels = entry.levels;
    const distribution = levels.map((l) => ({
      level: l,
      count: entry.records.filter((r) => levelScore(r.score, levels) === Number(l.score)).length
    })).sort((a, b) => b.level.score - a.level.score);
    const maxCount = Math.max(0, ...distribution.map((d) => d.count));
    distribution.forEach((d) => {
      d.pct = entry.records.length ? Math.round(d.count / entry.records.length * 100) : 0;
      d.dominant = d.count === maxCount && d.count > 0;
    });
    out.push({
      id: entry.id,
      name: entry.name,
      weight: entry.weight,
      levels,
      records: entry.records,
      avg,
      achieved: levelForScore(avg, levels),
      distribution,
      criteria,
      assessmentIds: [...entry.assessmentIds]
    });
  }
  return out.sort((a, b) => b.avg - a.avg);
}
function renderCompetencyStudent(comps) {
  if (!comps || !comps.length) return `<p class="empty-state">Belum ada data Learning Outcome untuk ditampilkan.</p>`;
  return `
    <div class="competency-simple">
      ${comps.map((c) => `
        <div class="competency-row competency-lo-row">
          <div class="competency-info">
            <strong>${escapeHtml(c.id)} \u2014 ${escapeHtml(c.name)}</strong>
            <span class="rubrik-muted">${c.records.length} evidence \xB7 kompetensi berbasis Learning Outcome</span>
            ${c.criteria?.length ? `<span class="rubrik-muted">Evidence: ${c.criteria.slice(0, 3).map((x) => `${escapeHtml(x.name)} (${Math.round(x.avg)})`).join(" \xB7 ")}</span>` : ""}
          </div>
          <div class="rubrik-skor">
            <span class="rubrik-score-badge ${scoreClass(c.achieved?.score || 1)}">${Math.round(c.avg)}</span>
            <span class="rubrik-muted">/100</span>
          </div>
        </div>`).join("")}
    </div>`;
}
function renderCompetencyClass(comps) {
  if (!comps || !comps.length) {
    return `<p class="empty-state">Belum ada data Learning Outcome. Pastikan setiap Learning Outcome terpetakan ke minimal satu soal dan soal memiliki evidence tervalidasi.</p>`;
  }
  return `
    <div class="competency-simple">
      ${comps.map((c) => `
        <div class="competency-row competency-lo-row">
          <div class="competency-info">
            <strong>${escapeHtml(c.id)} \u2014 ${escapeHtml(c.name)}</strong>
            <span class="rubrik-muted">${c.records.length} evidence \xB7 ${c.assessmentIds.length} assessment</span>
            ${c.criteria?.length ? `<span class="rubrik-muted">Kriteria pendukung: ${c.criteria.slice(0, 3).map((x) => `${escapeHtml(x.name)} (${Math.round(x.avg)})`).join(" \xB7 ")}</span>` : ""}
          </div>
          <div class="rubrik-skor">
            <span class="rubrik-score-badge ${scoreClass(c.achieved?.score || 1)}">${Math.round(c.avg)}</span>
            <span class="rubrik-muted">/100</span>
          </div>
        </div>`).join("")}
    </div>`;
}
var DEFAULT_LEVELS, scoreClass;
var init_competency_profile = __esm({
  "src/js/competency-profile.js"() {
    init_utils();
    DEFAULT_LEVELS = [
      { score: 4, label: "Sangat Baik", descriptor: "" },
      { score: 3, label: "Baik", descriptor: "" },
      { score: 2, label: "Cukup", descriptor: "" },
      { score: 1, label: "Kurang", descriptor: "" }
    ];
    scoreClass = (n) => `sb-${Math.max(1, Math.min(4, Number(n)))}`;
  }
});

// src/js/status.js
function getSubmissionStatus(submission) {
  if (!submission) return ASSESSMENT_STATUS.NOT_COMPLETED;
  if (submission.status) return submission.status;
  if (typeof submission.finalScore === "number" && Number.isFinite(submission.finalScore)) {
    return ASSESSMENT_STATUS.EVALUATED;
  }
  return ASSESSMENT_STATUS.NOT_COMPLETED;
}
function isEvaluatedEffective(submission) {
  return getSubmissionStatus(submission) === ASSESSMENT_STATUS.EVALUATED;
}
function hasValidScore(submission) {
  if (!isEvaluatedEffective(submission)) return false;
  return typeof submission.finalScore === "number" && Number.isFinite(submission.finalScore);
}
function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}
function statusBadgeInfo(status) {
  const map = {
    EVALUATED: { label: "\u2713 Evaluated", cls: "status-evaluated", title: "Hasil tervalidasi" },
    NEEDS_REVIEW: { label: "\u26A0 Needs Review", cls: "status-review", title: "Perlu tinjauan" },
    FAILED: { label: "\u2715 Evaluasi Gagal", cls: "status-failed", title: "Evaluasi tidak tersedia" },
    EVALUATING: { label: "Menilai\u2026", cls: "status-evaluating", title: "Sedang dievaluasi" },
    NOT_COMPLETED: { label: "\u2014 Belum Selesai", cls: "status-incomplete", title: "Belum dikumpulkan" },
    PUBLISHED: { label: "Published", cls: "status-published", title: "Diterbitkan" },
    DRAFT: { label: "Draft", cls: "status-draft", title: "Draf" },
    STARTED: { label: "Dimulai", cls: "status-started", title: "Dikerjakan" },
    SUBMITTED: { label: "Terkumpul", cls: "status-submitted", title: "Menunggu evaluasi" }
  };
  return map[status] || { label: statusLabel(status), cls: "status-muted", title: statusLabel(status) };
}
function renderStatusBadge(status) {
  const info = statusBadgeInfo(status);
  return `<span class="status-badge ${info.cls}" title="${escapeHtml(info.title || info.label)}">${info.label}</span>`;
}
var ASSESSMENT_STATUS, STATUS_LABELS;
var init_status = __esm({
  "src/js/status.js"() {
    init_utils();
    ASSESSMENT_STATUS = {
      DRAFT: "DRAFT",
      PUBLISHED: "PUBLISHED",
      STARTED: "STARTED",
      SUBMITTED: "SUBMITTED",
      EVALUATING: "EVALUATING",
      EVALUATED: "EVALUATED",
      NEEDS_REVIEW: "NEEDS_REVIEW",
      FAILED: "FAILED",
      NOT_COMPLETED: "NOT_COMPLETED"
    };
    STATUS_LABELS = {
      DRAFT: "Draft",
      PUBLISHED: "Published",
      STARTED: "Dimulai",
      SUBMITTED: "Terkumpul",
      EVALUATING: "Menilai\u2026",
      EVALUATED: "Evaluated",
      NEEDS_REVIEW: "Needs Review",
      FAILED: "Gagal",
      NOT_COMPLETED: "Belum Selesai"
    };
  }
});

// src/js/render.js
var render_exports = {};
__export(render_exports, {
  formatDuration: () => formatDuration,
  renderApp: () => renderApp,
  renderAssessmentItem: () => renderAssessmentItem,
  renderAssessments: () => renderAssessments,
  renderEvaluationPreview: () => renderEvaluationPreview,
  renderMonitoring: () => renderMonitoring,
  renderObservability: () => renderObservability,
  renderQuestion: () => renderQuestion,
  renderRubricTable: () => renderRubricTable,
  renderStudentArea: () => renderStudentArea,
  renderStudentHistory: () => renderStudentHistory,
  showResult: () => showResult,
  updateEvaluationProgress: () => updateEvaluationProgress
});
function renderApp(els, state, session) {
  renderAssessments(els, state);
  renderStudentArea(els, state, session);
  renderMonitoring(els, state);
}
function renderAssessments(els, state) {
  const activeTab = document.querySelector("#assessmentTabFilter .tab-filter-btn.active")?.dataset.tab || "all";
  let list = state.assessments;
  if (activeTab === "draft") list = list.filter((a) => a.status === "draft");
  if (activeTab === "published") list = list.filter((a) => a.status !== "draft");
  els.assessmentCount.textContent = list.length;
  if (!list.length) {
    const message = activeTab === "draft" ? "Penilaian yang belum dipublish akan muncul di sini." : "Buat penilaian pertama agar dapat ditinjau dan dibagikan ke kelas.";
    showEmpty(els.assessmentList, "list-stack empty-state", message);
    return;
  }
  els.assessmentList.className = "list-stack";
  els.assessmentList.innerHTML = list.map(renderAssessmentItem).join("");
}
function renderStudentArea(els, state, session) {
  const selectedClassId = els.studentClassFilter?.value;
  const studentFilter = document.querySelector("[data-student-filter].active")?.dataset?.studentFilter || "all";
  let visibleAssessments = state.assessments.filter((a) => a.status !== "closed");
  if (selectedClassId) {
    visibleAssessments = visibleAssessments.filter((a) => a.classId === selectedClassId);
  }
  if (studentFilter === "tryout") {
    visibleAssessments = visibleAssessments.filter((a) => a.isTryout);
  } else if (studentFilter === "assessment") {
    visibleAssessments = visibleAssessments.filter((a) => !a.isTryout);
  }
  if (!visibleAssessments.length) {
    els.studentEmpty?.classList.remove("hidden");
    if (els.studentAssessmentGrid) els.studentAssessmentGrid.innerHTML = "";
  } else {
    els.studentEmpty?.classList.add("hidden");
    if (els.studentAssessmentGrid) {
      els.studentAssessmentGrid.innerHTML = visibleAssessments.map((assessment) => {
        const studentSubmissions = state.submissions.filter((s) => s.assessmentId === assessment.id);
        const hasSubmitted = studentSubmissions.length > 0;
        let buttonText = "Mulai Kerjakan";
        let buttonClass = "primary-button start-assessment-btn";
        const isLocked = hasSubmitted && !assessment.allowRetakes;
        const latestSubmission = hasSubmitted ? studentSubmissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] : null;
        const maxAttempts = assessment.allowRetakes ? Infinity : Number(assessment.maxAttempts) || 1;
        const used = studentSubmissions.length;
        let attemptsText = `${Math.max(0, maxAttempts - used)} percobaan tersisa`;
        if (Number.isFinite(maxAttempts) && used >= maxAttempts) {
          attemptsText = "Percobaan habis";
        } else if (!Number.isFinite(maxAttempts)) {
          attemptsText = "Percobaan tak terbatas";
        }
        const timeLimit = Number(assessment.timeLimit) || 0;
        const timeText = timeLimit > 0 ? `\u23F1 ${formatDuration(timeLimit)} / soal` : "\u23F1 Tanpa batas waktu";
        let statusHtml = "";
        if (hasSubmitted) {
          const statusClass = isLocked ? "badge-closed" : "badge-published";
          const statusLabel2 = isLocked ? "Selesai" : "Dikerjakan";
          statusHtml = `<span class="tag ${statusClass}" style="width: fit-content;">${statusLabel2}</span>`;
        } else {
          statusHtml = `<span class="tag badge-published" style="width: fit-content;">Belum dikerjakan</span>`;
        }
        const scoreHtml = latestSubmission ? `<p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--emerald);">Nilai terakhir: ${latestSubmission.finalScore}</p>` : "";
        if (hasSubmitted && assessment.allowRetakes) {
          buttonText = "Kerjakan Ulang";
          buttonClass = "secondary-button start-assessment-btn";
        } else if (hasSubmitted && !assessment.allowRetakes) {
          buttonText = "Sudah Dikumpulkan";
          buttonClass = "secondary-button";
        }
        return `
          <div class="assessment-card" data-id="${assessment.id}" tabindex="0" role="button" aria-label="${escapeHtml(assessment.topic)} - ${assessment.difficulty} - ${assessment.questions.length} soal">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <h4>${escapeHtml(assessment.topic)}</h4>
              <div style="display:flex; gap:4px; align-items:center;">
                ${assessment.isTryout ? '<span class="tag tag-tryout">Tryout</span>' : ""}
                ${statusHtml}
              </div>
            </div>
            <span class="tag badge-published" style="width: fit-content;">${escapeHtml(assessment.difficulty)}</span>
            <div class="assessment-meta">
              <span>\u{1F4DD} ${assessment.questions.length} soal</span>
              <span>${timeText}</span>
              <span>\u{1F504} ${attemptsText}</span>
            </div>
            ${scoreHtml}
            <button type="button" class="${buttonClass}" data-id="${assessment.id}" style="margin-top: auto;" ${isLocked ? "disabled" : ""}>${buttonText}</button>
          </div>
        `;
      }).join("");
    }
  }
  if (session.currentAssessmentId) {
    els.studentDashboard?.classList.add("hidden");
    els.studentWorkspace?.classList.remove("hidden");
    renderQuestion(els, session.getCurrentAssessment(), session);
  } else {
    els.studentDashboard?.classList.remove("hidden");
    els.studentWorkspace?.classList.add("hidden");
  }
}
function renderQuestion(els, assessment, session) {
  if (!assessment) return;
  const question = assessment.questions[session.currentQuestionIndex];
  els.questionProgress.textContent = `Soal ${session.currentQuestionIndex + 1} dari ${assessment.questions.length}`;
  els.activeDifficulty.textContent = assessment.difficulty;
  els.activeQuestion.textContent = question.prompt;
  els.activeHint.textContent = "";
  els.activeHint.classList.add("hidden");
  if (els.activeOutcome) {
    els.activeOutcome.textContent = question.outcome || assessment.outcomes || "";
    els.activeOutcome.classList.toggle("hidden", !els.activeOutcome.textContent);
  }
  if (els.activeRubric) {
    const rubricText = question.rubric || "";
    els.activeRubric.innerHTML = rubricText ? renderRubricTable(rubricText) : "";
    els.activeRubric.classList.toggle("hidden", !rubricText);
  }
  const isOralExam = assessment.oralExamEnabled !== false;
  if (!isOralExam) {
    els.answerText.placeholder = "Tulis jawaban Anda di sini.";
    els.answerText.readOnly = false;
    els.recordButton.disabled = true;
    els.recorderPanel?.classList.add("hidden");
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Mode tulisan aktif. Jawab setiap soal dengan mengetik jawaban Anda.";
    }
  } else if (assessment.disableManualTyping) {
    els.answerText.placeholder = "Jawaban manual dimatikan untuk penilaian ini. Silakan menjawab menggunakan rekaman suara.";
    els.answerText.readOnly = true;
    els.recordButton.disabled = false;
    els.recorderPanel?.classList.remove("hidden");
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Gunakan Chrome/Edge di " + window.location.origin + " dan izinkan mikrofon. Siswa wajib menjawab secara lisan (pengetikan manual dinonaktifkan).";
    }
  } else {
    els.answerText.placeholder = "Transkripsi otomatis atau jawaban manual siswa akan muncul di sini";
    els.answerText.readOnly = false;
    els.recordButton.disabled = false;
    els.recorderPanel?.classList.remove("hidden");
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Gunakan Chrome/Edge di " + window.location.origin + " dan izinkan mikrofon. Jika transkripsi otomatis tidak tersedia, ketik hasil rekaman manual.";
    }
  }
  els.answerText.value = session.currentAnswers[session.currentQuestionIndex]?.text || "";
  els.prevQuestion.disabled = session.currentQuestionIndex === 0;
  renderAnswerMap(els, assessment, session.currentAnswers);
}
function renderMonitoring(els, state) {
  const selectedClassId = els.monitorClassFilter?.value;
  const rangeDays = Number(els.monitorRangeFilter?.value) || 0;
  let visibleSubmissions = state.submissions;
  if (selectedClassId) {
    visibleSubmissions = state.submissions.filter((s) => s.classId === selectedClassId);
  }
  if (rangeDays > 0) {
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1e3;
    visibleSubmissions = visibleSubmissions.filter((s) => new Date(s.submittedAt).getTime() >= cutoff);
  }
  els.submissionCount.textContent = visibleSubmissions.length;
  if (els.downloadClassCsvBtn) {
    els.downloadClassCsvBtn.style.display = selectedClassId ? "inline-flex" : "none";
  }
  if (!visibleSubmissions.length) {
    els.classAverage.textContent = "\u2014";
    els.classAverage.style.setProperty("--score", "0");
    if (els.trendAssessmentCount) els.trendAssessmentCount.textContent = "0 penilaian";
    showEmpty(els.trendList, "trend-list empty-state", EMPTY_TRENDS);
    els.submissionList.className = "";
    els.submissionList.innerHTML = `<tr><td colspan="6" class="empty-state">${EMPTY_SUBMISSIONS}</td></tr>`;
    return;
  }
  const evaluated = visibleSubmissions.filter(hasValidScore);
  const avg = average(evaluated, (submission) => submission.finalScore);
  const avgText = evaluated.length ? String(avg) : "\u2014";
  els.classAverage.textContent = avgText;
  els.classAverage.style.setProperty("--score", avg || 0);
  renderTrend(els, evaluated);
  renderSubmissions(els, visibleSubmissions);
}
function renderEvaluationPreview(els, assessment, answers) {
  if (!els.evaluationPreviewList) return;
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  const list = questions.map((q, idx) => {
    const answer = answers && answers[idx];
    const answerText = String(answer?.text || "").trim();
    const hasAudio = Boolean(answer?.audio);
    const answerHtml = answerText ? `<p class="ev-preview-answer"><b>Jawaban:</b> <i>"${escapeHtml(answerText)}"</i></p>` : hasAudio ? `<p class="ev-preview-answer"><b>Jawaban:</b> <i>Rekaman suara</i></p>` : `<p class="ev-preview-answer ev-preview-empty"><b>Jawaban:</b> <i>Belum dijawab</i></p>`;
    return `
      <details class="ev-preview-card" open>
        <summary>
          <span class="ev-preview-title"><strong>Soal ${idx + 1}</strong></span>
          <span class="ev-preview-score" aria-label="Nilai sedang diproses">
            <span class="ev-score-skeleton"></span>
          </span>
        </summary>
        <div class="ev-preview-body">
          <div class="rich-text">${formatRichText(q.prompt || `Soal ${idx + 1}`)}</div>
          ${answerHtml}
          ${hasAudio ? `<div style="margin-top:8px;"><span class="tag">\u{1F3A4} Audio tersimpan</span></div>` : ""}
        </div>
      </details>
    `;
  }).join("");
  els.evaluationPreviewList.innerHTML = `
    <div class="ev-preview-note">Menampilkan soal &amp; jawaban Anda sementara AI menilai...</div>
    ${list}
  `;
}
function updateEvaluationProgress(els, text) {
  if (els.evaluationProgressText && text) {
    els.evaluationProgressText.textContent = text;
  }
}
function showResult(els, submission, auth = null) {
  els.resultPanel._returnFocus = document.activeElement;
  els.resultPanel.classList.remove("hidden");
  els.resultPanel.dataset.submissionId = submission.id;
  const summary = buildResultSummary(submission);
  els.resultPanel.innerHTML = `
    <div class="result-modal-content">
      <button class="result-close-btn close-result-btn" type="button" aria-label="Tutup hasil penilaian">&times;</button>
      <div class="result-header">
        <div style="flex: 1; min-width: 0;">
          <h3 style="margin-right: 40px;">Hasil penilaian: ${escapeHtml(submission.assessmentTitle)}</h3>
          <div class="rich-text">${formatRichText(submission.feedback)}</div>
        </div>
        <div class="score-badge">${submission.finalScore}</div>
      </div>

      <div class="result-summary">
        <div class="summary-score">
          <span class="summary-score-label">Skor akhir</span>
          <strong>${submission.finalScore}</strong>
          <span class="summary-score-sub">dari 100</span>
        </div>
        <div class="summary-columns">
          <div class="summary-col summary-strengths">
            <h4>\u{1F4AA} Kekuatan</h4>
            ${summary.strengths.length ? `<ul>${summary.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : `<p class="summary-empty">Belum ada catatan kekuatan.</p>`}
          </div>
          <div class="summary-col summary-gaps">
            <h4>\u{1F3AF} Fokus perbaikan</h4>
            ${summary.gaps.length ? `<ul>${summary.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>` : `<p class="summary-empty">Tidak ada catatan perbaikan.</p>`}
          </div>
        </div>
      </div>

      <div class="result-details">
        <button type="button" class="result-details-toggle" aria-expanded="false">
          <span>Detail per soal</span>
          <span class="result-details-caret">\u25BE</span>
        </button>
        <div class="result-details-body hidden">
          <div class="feedback-grid">
            ${submission.questionScores.map((item, index) => renderFeedbackCard(item, index, auth)).join("")}
          </div>
        </div>
      </div>

      <div class="result-footer">
        <button class="secondary-button" type="button" onclick="window.print()" style="margin-right: auto;">\u{1F5A8}\uFE0F Cetak/PDF</button>
        <button class="primary-button close-result-btn" type="button">Tutup hasil</button>
      </div>
    </div>
  `;
  const toggle = els.resultPanel.querySelector(".result-details-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const body = els.resultPanel.querySelector(".result-details-body");
      const expanded = body.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.querySelector(".result-details-caret").textContent = expanded ? "\u25B8" : "\u25BE";
    });
  }
  requestAnimationFrame(() => els.resultPanel.querySelector(".result-close-btn")?.focus());
}
function buildResultSummary(submission) {
  const strengths = [];
  const gaps = [];
  (submission.questionScores || []).forEach((item) => {
    (item.strengths || []).forEach((s) => strengths.push(s));
    (item.gaps || []).forEach((g) => gaps.push(g));
  });
  return {
    strengths: [...new Set(strengths)].slice(0, 2),
    gaps: [...new Set(gaps)].slice(0, 2)
  };
}
function renderAssessmentItem(assessment) {
  const isOralExam = assessment.oralExamEnabled !== false;
  const isClosed = assessment.status === "closed";
  const statusBadge = isClosed ? `<span class="tag badge-closed" style="padding: 2px 6px; font-size: 0.65rem;">Akses ditutup</span>` : `<span class="tag badge-published" style="padding: 2px 6px; font-size: 0.65rem;">${isOralExam ? "Lisan" : "Tulisan"}</span>`;
  return `
    <article class="assessment-item" data-id="${assessment.id}">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
          <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(assessment.topic)}</strong>
          ${statusBadge}
        </div>
        <p>${escapeHtml(compactText(assessment.outcomes))}</p>
        <div class="item-actions">
          <button type="button" class="action-button edit-assessment">Edit Soal</button>
          <button type="button" class="action-button download-grades-assessment">Download Nilai</button>
          <button type="button" class="action-button ${isClosed ? "reopen-assessment" : "close-assessment"}">${isClosed ? "Buka akses siswa" : "Tutup akses siswa"}</button>
          <div class="more-menu">
            <button type="button" class="action-button more-menu-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Menu lainnya">\u22EF</button>
            <div class="more-menu-dropdown hidden">
              <button type="button" class="more-menu-item danger-button delete-assessment">Hapus penilaian</button>
            </div>
          </div>
        </div>
      </div>
      <span>${assessment.questions.length} soal</span>
    </article>
  `;
}
function renderAnswerMap(els, assessment, answers) {
  els.answerMap.innerHTML = assessment.questions.map((_, index) => {
    const answer = answers[index];
    const hasText = (answer?.text || "").trim().length > 0;
    const hasAudio = Boolean(answer?.audio);
    const done = hasText || hasAudio;
    const cls = done ? "done" : "unanswered";
    const title = done ? `Soal ${index + 1} sudah dijawab` : `Soal ${index + 1} belum dijawab`;
    return `<div class="answer-dot ${cls}" title="${title}" aria-label="${title}">${index + 1}</div>`;
  }).join("");
}
function renderTrend(els, submissions) {
  const trends = buildTrends(submissions);
  const assessmentCount = new Set(submissions.map((s) => s.assessmentId)).size;
  if (els.trendAssessmentCount) {
    els.trendAssessmentCount.textContent = `${assessmentCount} penilaian`;
  }
  els.trendList.className = trends.length ? "trend-list" : "trend-list empty-state";
  els.trendList.innerHTML = trends.length ? trends.map(renderTrendItem).join("") : EMPTY_TRENDS;
}
function renderSubmissions(els, submissions) {
  els.submissionList.className = "";
  els.submissionList.innerHTML = submissions.slice().reverse().map(renderSubmissionItem).join("");
}
function renderSubmissionItem(submission) {
  const date = submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const status = getSubmissionStatus(submission);
  const scoreHtml = hasValidScore(submission) ? `<span class="metric-pill" style="padding: 4px 12px;">${submission.finalScore}</span>` : `<span class="score-muted-text" title="Tidak diterbitkan \u2014 evaluasi belum valid">\u2014</span>`;
  return `
    <tr class="submission-row" data-id="${submission.id}">
      <td data-label="Siswa"><strong>${escapeHtml(submission.studentName)}</strong></td>
      <td data-label="Topik">${escapeHtml(submission.assessmentTitle)}</td>
      <td data-label="Tanggal">${date}</td>
      <td data-label="Skor AI">${scoreHtml}</td>
      <td data-label="Status">${renderStatusBadge(status)}</td>
      <td data-label="Aksi">
        <button type="button" class="secondary-button view-submission-btn" style="min-height: 36px; font-size: 0.9rem;">Lihat Detail</button>
      </td>
    </tr>
  `;
}
function renderTrendItem(trend) {
  const deltaLabel = `${trend.delta >= 0 ? "+" : ""}${trend.delta}`;
  const deltaClass = trend.delta > 0 ? "trend-up" : trend.delta < 0 ? "trend-down" : "trend-flat";
  const history2 = trend.history.slice(-5).map((h) => `
    <span class="trend-point" title="${escapeHtml(h.date)}: ${h.score}">
      <span class="trend-point-bar" style="height: ${Math.max(4, h.score)}%"></span>
      <span class="trend-point-score">${h.score}</span>
    </span>
  `).join("");
  return `
    <div class="trend-item">
      <header>
        <strong>${escapeHtml(trend.studentName)}</strong>
        <span class="trend-delta ${deltaClass}">${trend.latest} (${deltaLabel})</span>
      </header>
      <div class="trend-track"><div class="trend-fill" style="width: ${trend.latest}%"></div></div>
      ${trend.history.length > 1 ? `<div class="trend-history">${history2}</div>` : ""}
    </div>
  `;
}
function formatDuration(seconds) {
  if (!seconds) return "0 detik";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s} detik`;
}
function renderFeedbackCard(item, index, auth) {
  const audioHtml = item.audio ? `<div style="margin-top: 12px; margin-bottom: 12px;"><audio controls src="${escapeHtml(item.audio)}" style="width: 100%; height: 36px;"></audio></div>` : "";
  const isTeacher = auth && auth.user && auth.user.role === "teacher";
  const isStudent = auth && auth.user && auth.user.role === "student";
  const durationText = item.duration !== void 0 ? ` | \u23F1\uFE0F ${formatDuration(item.duration)}` : "";
  const complaint = item.complaint;
  let complaintHtml = "";
  if (complaint) {
    const statusLabel2 = complaint.status === "resolved" ? "Selesai" : complaint.status === "rejected" ? "Ditolak" : "Menunggu";
    const statusClass = complaint.status === "resolved" ? "complaint-resolved" : complaint.status === "rejected" ? "complaint-rejected" : "complaint-pending";
    complaintHtml = `
      <div class="complaint-box ${statusClass}">
        <strong>\u{1F4E9} Komplain siswa:</strong>
        <p>${escapeHtml(complaint.reason)}</p>
        ${complaint.status === "rejected" ? `<p class="complaint-response"><b>Keputusan guru:</b> Komplain ditolak. Skor dikurangi 20 poin.${complaint.response ? ` \u2014 ${escapeHtml(complaint.response)}` : ""}</p>` : ""}
        ${complaint.status === "resolved" && complaint.response ? `<p class="complaint-response"><b>Respon guru:</b> ${escapeHtml(complaint.response)}</p>` : ""}
        <span class="tag">Status: ${statusLabel2}</span>
      </div>
    `;
  }
  const complaintBtn = isStudent && !complaint ? `<button type="button" class="action-button complaint-btn" data-index="${index}">Komplain</button>` : "";
  const respondBtn = isTeacher && complaint && complaint.status === "pending" ? `<button type="button" class="action-button respond-complaint-btn" data-index="${index}">Respon Komplain</button>` : "";
  const rejectBtn = isTeacher && complaint && complaint.status === "pending" ? `<button type="button" class="action-button danger-button reject-complaint-btn" data-index="${index}">Tolak Komplain</button>` : "";
  return `
    <article class="feedback-card" data-index="${index}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>Soal ${index + 1} - Skor <span class="qs-score">${item.score}</span>${durationText}</strong>
        <div style="display: flex; gap: 8px;">
          ${complaintBtn}
          ${respondBtn}
          ${rejectBtn}
          <button type="button" class="action-button edit-override-btn ${isTeacher ? "" : "hidden"}" data-index="${index}">Koreksi</button>
        </div>
      </div>
      <div class="rich-text">${formatRichText(item.question)}</div>
      ${audioHtml}
      <p><b>Jawaban:</b> <i>"${escapeHtml(item.answer || (item.audio ? "Hanya audio" : "Tidak ada jawaban"))}"</i></p>
      <p><b>Kelebihan:</b> <span class="qs-strengths rich-text">${formatRichText(item.strengths?.join(" ") || "")}</span></p>
      <p><b>Masih kurang:</b> <span class="qs-gaps rich-text">${formatRichText(item.gaps?.join(" ") || "")}</span></p>
      ${complaintHtml}
      <div class="tag-row">
        ${(item.matched || []).slice(0, 5).map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}
      </div>
    </article>
  `;
}
function formatRichText(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  const lines = escaped.split(/\r?\n/);
  const html = [];
  let inList = null;
  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 6);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const ulItem = line.match(/^[-*•]\s+(.*)$/);
    if (ulItem) {
      if (inList !== "ul") {
        closeList();
        html.push("<ul>");
        inList = "ul";
      }
      html.push(`<li>${inlineMarkdown(ulItem[1])}</li>`);
      continue;
    }
    const olItem = line.match(/^\d+[.)]\s+(.*)$/);
    if (olItem) {
      if (inList !== "ol") {
        closeList();
        html.push("<ol>");
        inList = "ol";
      }
      html.push(`<li>${inlineMarkdown(olItem[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      closeList();
      html.push("<hr>");
      continue;
    }
    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return html.join("");
}
function inlineMarkdown(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
}
function buildTrends(submissions) {
  const latestByStudent = /* @__PURE__ */ new Map();
  submissions.forEach((submission) => {
    const list = latestByStudent.get(submission.studentName) || [];
    list.push(submission);
    latestByStudent.set(submission.studentName, list);
  });
  return [...latestByStudent.entries()].map(([studentName, studentSubmissions]) => {
    const sorted = studentSubmissions.slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const latest = sorted.at(-1).finalScore;
    const previous = sorted.length > 1 ? sorted.at(-2).finalScore : latest;
    const history2 = sorted.map((s) => ({
      score: s.finalScore,
      date: new Date(s.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
    }));
    return { studentName, latest, delta: latest - previous, history: history2 };
  }).sort((a, b) => b.latest - a.latest);
}
function renderStudentHistory(els, submissions, currentStudentName) {
  const studentSubmissions = submissions.filter((s) => s.studentName === currentStudentName);
  if (!studentSubmissions.length) {
    els.studentHistoryList.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada riwayat penilaian.</td></tr>';
    return;
  }
  els.studentHistoryList.innerHTML = studentSubmissions.slice().reverse().map((sub) => {
    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
    return `
      <tr class="submission-row" data-id="${sub.id}">
        <td data-label="Topik"><strong>${escapeHtml(sub.assessmentTitle)}</strong></td>
        <td data-label="Tanggal">${date}</td>
        <td data-label="Skor"><span class="metric-pill" style="padding: 4px 12px;">${sub.finalScore}</span></td>
        <td data-label="Aksi">
          <button type="button" class="secondary-button view-submission-btn" style="min-height: 36px; font-size: 0.9rem;">Lihat Hasil</button>
        </td>
      </tr>
    `;
  }).join("");
}
function renderObservability(els, data) {
  const metrics = data?.metrics || {};
  const system = data?.system || {};
  const tail = data?.tailLatency || {};
  const prefix = data?.prefixOptimization || {};
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const pagination = data?.pagination || {};
  if (els.telemetryLastUpdated) {
    els.telemetryLastUpdated.textContent = data?.lastUpdated ? `Last updated ${new Date(data.lastUpdated).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}` : "\u2014";
  }
  if (els.telemetryTotalCalls) {
    els.telemetryTotalCalls.textContent = metrics.totalCalls != null ? metrics.totalCalls.toLocaleString("id-ID") : "\u2014";
  }
  if (els.telemetryCallsDelta) {
    els.telemetryCallsDelta.textContent = metrics.callsToday != null ? `+${metrics.callsToday.toLocaleString("id-ID")} today` : "\u2014";
  }
  if (els.telemetryErrorRate) {
    els.telemetryErrorRate.textContent = metrics.errorRate != null ? `${metrics.errorRate}%` : "\u2014";
  }
  if (els.telemetryErrorHealth) {
    if (metrics.errorRate == null) {
      els.telemetryErrorHealth.textContent = "Telemetry unavailable";
    } else {
      const ok = metrics.errorRate === 0;
      els.telemetryErrorHealth.textContent = ok ? "\u2713 Healthy" : `\u26A0 ${metrics.errorRate}% errors`;
      els.telemetryErrorHealth.className = ok ? "ob-kpi-delta ob-good" : "ob-kpi-delta ob-warn";
    }
  }
  if (els.telemetryP50) els.telemetryP50.textContent = formatLatency(metrics.p50LatencyMs);
  if (els.telemetryP95) {
    els.telemetryP95.textContent = formatLatency(metrics.p95LatencyMs);
  }
  if (els.telemetryP95Health) {
    els.telemetryP95Health.textContent = tail.flagged ? "\u26A0 High tail latency" : formatAvgLabel(metrics.avgLatencyMs);
    els.telemetryP95Health.className = tail.flagged ? "ob-kpi-delta ob-warn" : "ob-kpi-delta";
  }
  if (els.telemetryTailAlert) {
    if (tail.flagged) {
      els.telemetryTailAlert.className = "ob-alert ob-alert-warn";
      els.telemetryTailAlert.innerHTML = `
        <strong>\u26A0 High Tail Latency</strong>
        <p>p95 latency is significantly higher than typical request latency.</p>
        <p>p50: ${formatLatency(tail.p50)} &nbsp;\xB7&nbsp; p95: ${formatLatency(tail.p95)}
        ${tail.ratio != null ? ` &nbsp;\xB7&nbsp; p95/p50 = ${tail.ratio}\xD7` : ""}</p>
        <span class="sem-badge sem-derived">\u0192 Derived</span>`;
    } else {
      els.telemetryTailAlert.className = "ob-alert hidden";
      els.telemetryTailAlert.innerHTML = "";
    }
  }
  if (els.telemetryLatencyDist) {
    const dist = Array.isArray(data?.latencyDistribution) ? data.latencyDistribution : [];
    if (!dist.length) {
      els.telemetryLatencyDist.innerHTML = '<p class="empty-state">Belum ada data latency.</p>';
    } else {
      const max = Math.max(1, ...dist.map((b) => b.count));
      els.telemetryLatencyDist.innerHTML = dist.map(
        (b) => `
          <div class="ob-hist-row">
            <span class="ob-hist-label">${escapeHtml(b.label)}</span>
            <div class="ob-hist-track" role="img" aria-label="${escapeHtml(b.label)}: ${b.count} calls">
              <div class="ob-hist-bar" style="width: ${Math.max(2, Math.round(b.count / max * 100))}%"></div>
            </div>
            <span class="ob-hist-count">${b.count}</span>
          </div>`
      ).join("");
    }
  }
  if (els.telemetryPercentileTable) {
    const pRows = [
      ["p50", metrics.p50LatencyMs],
      ["p75", metrics.p75LatencyMs],
      ["p90", metrics.p90LatencyMs],
      ["p95", metrics.p95LatencyMs],
      ["p99", metrics.p99LatencyMs]
    ];
    els.telemetryPercentileTable.innerHTML = pRows.map(
      ([label, value]) => `
        <tr>
          <td><code>${label}</code></td>
          <td><strong>${formatLatency(value)}</strong></td>
        </tr>`
    ).join("");
  }
  if (els.telemetryTailRatio) {
    els.telemetryTailRatio.innerHTML = tail.ratio != null ? `<span class="ob-tail-ratio-text">p95 / p50 = ${tail.ratio}\xD7 (threshold ${tail.threshold}\xD7)</span>` : "";
  }
  renderTableRows(els.telemetryLatencyByOp, data?.latencyByOperation, (row) => `
    <tr>
      <td><code>${escapeHtml(row.operation)}</code></td>
      <td>${row.calls.toLocaleString("id-ID")}</td>
      <td>${formatLatency(row.p50)}</td>
      <td>${formatLatency(row.p95)}</td>
      <td>${formatLatency(row.avg)}</td>
      <td>${row.errorRate != null ? `${row.errorRate}%` : "\u2014"}</td>
    </tr>`, 7, "Belum ada data per operation.");
  if (els.telemetryTokens) {
    els.telemetryTokens.textContent = (metrics.totalTokens ?? 0).toLocaleString("id-ID");
  }
  if (els.telemetryTokenSplit) {
    const total = metrics.totalTokens || 0;
    const promptPct = total > 0 ? metrics.promptTokenPct ?? 0 : 0;
    const completionPct = total > 0 ? metrics.completionTokenPct ?? 0 : 0;
    els.telemetryTokenSplit.innerHTML = `
      <div class="ob-split-bar" role="img" aria-label="Prompt ${promptPct}%, completion ${completionPct}%">
        <div class="ob-split-prompt" style="width: ${promptPct}%"></div>
        <div class="ob-split-completion" style="width: ${completionPct}%"></div>
      </div>
      <div class="ob-split-legend">
        <span><i class="ob-dot ob-dot-prompt"></i>Prompt ${(metrics.promptTokens ?? 0).toLocaleString("id-ID")} (${promptPct}%)</span>
        <span><i class="ob-dot ob-dot-completion"></i>Completion ${(metrics.completionTokens ?? 0).toLocaleString("id-ID")} (${completionPct}%)</span>
      </div>`;
  }
  if (els.telemetryAvgTokens) els.telemetryAvgTokens.textContent = (metrics.avgTokensPerRequest ?? 0).toLocaleString("id-ID");
  if (els.telemetryAvgPrompt) els.telemetryAvgPrompt.textContent = (metrics.avgPromptPerRequest ?? 0).toLocaleString("id-ID");
  if (els.telemetryAvgCompletion) els.telemetryAvgCompletion.textContent = (metrics.avgCompletionPerRequest ?? 0).toLocaleString("id-ID");
  if (els.telemetryTokensPerCall) els.telemetryTokensPerCall.textContent = (metrics.tokensPerApiCall ?? 0).toLocaleString("id-ID");
  if (els.telemetryTokensPerEval) {
    els.telemetryTokensPerEval.textContent = metrics.tokensPerEvaluation != null ? metrics.tokensPerEvaluation.toLocaleString("id-ID") : "\u2014";
  }
  if (els.telemetryCost) {
    els.telemetryCost.textContent = metrics.estimatedCostUSD != null ? `$${metrics.estimatedCostUSD.toFixed(5)}` : "\u2014";
  }
  if (els.telemetryCostPerEval) {
    els.telemetryCostPerEval.textContent = metrics.costPerEvaluation != null ? `$${metrics.costPerEvaluation.toFixed(5)}` : "\u2014";
  }
  if (els.telemetryCostPer1K) {
    els.telemetryCostPer1K.textContent = metrics.costPer1KTokens != null ? `$${metrics.costPer1KTokens.toFixed(5)}` : "\u2014";
  }
  renderTableRows(els.telemetryCostByOp, data?.costByOperation, (row) => `
    <tr>
      <td><code>${escapeHtml(row.operation)}</code></td>
      <td>${row.calls.toLocaleString("id-ID")}</td>
      <td>${row.tokens.toLocaleString("id-ID")}</td>
      <td>$${(row.estimatedCostUSD ?? 0).toFixed(5)}</td>
    </tr>`, 4, "Belum ada data biaya per operation.");
  if (els.telemetryPrefixTokens) {
    els.telemetryPrefixTokens.textContent = `${(prefix.estimatedSavedTokens ?? 0).toLocaleString("id-ID")} tokens`;
  }
  if (els.telemetryPrefixPct) {
    els.telemetryPrefixPct.textContent = `${prefix.estimatedPrefixReusePct ?? 0}%`;
  }
  if (els.telemetryPrefixCost) {
    els.telemetryPrefixCost.textContent = prefix.estimatedSavedCostUSD != null ? `$${prefix.estimatedSavedCostUSD.toFixed(5)}` : "\u2014";
  }
  if (els.telemetryCacheHits) {
    els.telemetryCacheHits.textContent = prefix.actualCacheHits != null ? prefix.actualCacheHits.toLocaleString("id-ID") : "Not available";
  }
  if (els.telemetryCacheMisses) {
    els.telemetryCacheMisses.textContent = prefix.actualCacheMisses != null ? prefix.actualCacheMisses.toLocaleString("id-ID") : "Not available";
  }
  if (els.telemetryKvStatus) {
    els.telemetryKvStatus.innerHTML = prefix.kvCacheAvailable ? `<span class="ob-kv-status-ok">\u2713 ${escapeHtml(prefix.statusNote || "Actual provider KV-cache telemetry available.")}</span>` : `<span class="ob-kv-status-muted">\u2139 ${escapeHtml(prefix.statusNote || "Actual provider KV-cache telemetry unavailable.")}</span>`;
  }
  renderTableRows(els.telemetryProviderTable, data?.providerPerformance, (row) => `
    <tr>
      <td><code>${escapeHtml(row.model)}</code></td>
      <td>${row.calls.toLocaleString("id-ID")}</td>
      <td>${formatLatency(row.p50)}</td>
      <td>${formatLatency(row.p95)}</td>
      <td>${row.totalTokens.toLocaleString("id-ID")}</td>
      <td>$${(row.estimatedCostUSD ?? 0).toFixed(5)}</td>
      <td>${row.errorRate != null ? `${row.errorRate}%` : "\u2014"}</td>
    </tr>`, 7, "Belum ada data provider.");
  renderTableRows(els.telemetrySlowestCalls, data?.slowestCalls, (row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code>${escapeHtml(row.action)}</code></td>
      <td><strong>${formatLatency(row.latency_ms)}</strong></td>
      <td>${(row.total_tokens ?? 0).toLocaleString("id-ID")}</td>
      <td style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(row.model)}</td>
      <td><span class="status-badge ${row.status === "success" ? "success" : "error"}">${escapeHtml((row.status || "\u2014").toUpperCase())}</span></td>
      <td style="font-size: 0.85rem; color: var(--muted);">${formatDateTime(row.created_at)}</td>
    </tr>`, 7, "Belum ada panggilan lambat.");
  renderSystemHealth(els, system);
  if (els.telemetryFilterOp) {
    const ops = data?.logFilters?.operations || [];
    const current = els.telemetryFilterOp.value;
    els.telemetryFilterOp.innerHTML = '<option value="">Semua operation</option>' + ops.map((op) => `<option value="${escapeHtml(op)}" ${op === current ? "selected" : ""}>${escapeHtml(op)}</option>`).join("");
  }
  if (els.telemetryFilterModel) {
    const models = data?.logFilters?.models || [];
    const current = els.telemetryFilterModel.value;
    els.telemetryFilterModel.innerHTML = '<option value="">Semua model</option>' + models.map((m) => `<option value="${escapeHtml(m)}" ${m === current ? "selected" : ""}>${escapeHtml(m)}</option>`).join("");
  }
  if (els.telemetryLogCount) {
    els.telemetryLogCount.textContent = pagination.total != null ? `${pagination.total.toLocaleString("id-ID")} calls${pagination.offset > 0 ? ` (offset ${pagination.offset})` : ""}` : "";
  }
  if (els.telemetryLogPagination) {
    const total = pagination.total != null ? pagination.total : 0;
    const pageSize = pagination.limit || 10;
    const offset = pagination.offset || 0;
    const hasLogs = total > 0;
    const currentPage = hasLogs ? Math.floor(offset / pageSize) + 1 : 0;
    const totalPages = hasLogs ? Math.max(1, Math.ceil(total / pageSize)) : 0;
    els.telemetryLogPagination.style.display = hasLogs ? "" : "none";
    if (els.telemetryLogPageInfo) {
      els.telemetryLogPageInfo.textContent = hasLogs ? `Page ${currentPage} of ${totalPages}` : "\u2014";
    }
    if (els.telemetryLogPrev) {
      els.telemetryLogPrev.disabled = currentPage <= 1;
    }
    if (els.telemetryLogNext) {
      els.telemetryLogNext.disabled = currentPage >= totalPages;
    }
  }
  if (els.telemetryLogList) {
    if (!logs.length) {
      els.telemetryLogList.innerHTML = `<tr><td colspan="6" class="empty-state">Baru ada log panggilan AI. Data akan muncul setelah AI dipakai pertama kali.</td></tr>`;
    } else {
      els.telemetryLogList.innerHTML = logs.map(renderLogRow).join("");
    }
  }
}
function renderLogRow(log) {
  const statusClass = log.status === "success" ? "success" : "error";
  const statusLabel2 = log.status === "success" ? "SUCCESS" : "ERROR";
  const hasSaved = log.estimated_prefix_cache_savings > 0;
  const cacheHitText = log.cache_read_input_tokens > 0 ? ` \xB7 cache-hit ${log.cache_read_input_tokens}` : "";
  const retryText = log.retry_count > 0 ? ` \xB7 retries ${log.retry_count}` : "";
  return `
    <tr>
      <td>
        <strong>${escapeHtml(log.action)}</strong>
        ${log.error_message ? `<div style="font-size: 0.75rem; color: var(--rose); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(log.error_message)}">${escapeHtml(log.error_message)}</div>` : ""}
      </td>
      <td><span style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(log.model)}</span></td>
      <td>${formatLatency(log.latency_ms)}</td>
      <td>
        <strong>${(log.total_tokens ?? 0).toLocaleString("id-ID")}</strong>
        <div style="font-size: 0.75rem; color: var(--muted);">
          Prompt: ${(log.prompt_tokens ?? 0).toLocaleString("id-ID")}
          \xB7 Completion: ${(log.completion_tokens ?? 0).toLocaleString("id-ID")}
          ${hasSaved ? `<div style="color: var(--emerald);">Estimated reusable prefix: ${log.estimated_prefix_cache_savings.toLocaleString("id-ID")}</div>` : ""}
          ${cacheHitText ? `<span style="color: var(--sky);">${cacheHitText}</span>` : ""}
          ${retryText ? `<span style="color: var(--amber);">${retryText}</span>` : ""}
        </div>
      </td>
      <td><span class="status-badge ${statusClass}">${statusLabel2}</span></td>
      <td><span style="font-size: 0.85rem; color: var(--muted);">${formatDateTime(log.created_at)}</span></td>
    </tr>`;
}
function renderSystemHealth(els, system) {
  if (els.telemetryRestartAlert && system.restart) {
    const r = system.restart;
    if (r.recentlyRestarted) {
      els.telemetryRestartAlert.className = "ob-alert ob-alert-warn";
      els.telemetryRestartAlert.innerHTML = `
        <strong>\u26A0 Server recently restarted</strong>
        <p>Current uptime: ${formatDuration(r.uptimeSeconds ?? 0)}${r.restartCount != null ? ` \xB7 Restart count: ${r.restartCount}` : ""}</p>
        <span class="sem-badge sem-derived">\u0192 Derived</span>`;
    } else {
      els.telemetryRestartAlert.className = "ob-alert hidden";
      els.telemetryRestartAlert.innerHTML = "";
    }
  }
  if (els.sysHealthList) {
    const items = [
      { label: "API", status: system.apiHealthy ? "\u2713 Healthy" : "\u2717 Unhealthy", ok: system.apiHealthy !== false },
      { label: "Database", status: system.databaseHealthy ? "\u2713 Healthy" : "\u2717 Unhealthy", ok: system.databaseHealthy !== false },
      { label: "AI Provider", status: system.providerHealthy ? "\u2713 Healthy" : "\u26A0 Degraded", ok: system.providerHealthy !== false },
      { label: "Memory", status: `${system.memoryHeapUsedMB ?? 0} MB / ${system.memoryHeapTotalMB ?? 0} MB`, ok: null },
      { label: "CPU Process", status: `${system.cpuUserMs ?? 0} ms`, ok: null },
      { label: "Uptime", status: formatDuration(system.uptimeSeconds ?? 0), ok: null }
    ];
    els.sysHealthList.innerHTML = items.map(
      (item) => `
        <div class="ob-block ob-sys-item">
          <span class="ob-sys-label">${escapeHtml(item.label)}</span>
          <strong class="${item.ok === true ? "ob-good" : item.ok === false ? "ob-warn" : ""}">${escapeHtml(item.status)}</strong>
        </div>`
    ).join("");
  }
  if (els.sysMemoryHeap) els.sysMemoryHeap.textContent = `${system.memoryHeapUsedMB ?? 0} MB`;
  if (els.sysMemoryTotal) els.sysMemoryTotal.textContent = `Allocated: ${system.memoryHeapTotalMB ?? 0} MB`;
  if (els.sysCpuUsage) els.sysCpuUsage.textContent = `${system.cpuUserMs ?? 0} ms`;
  if (els.sysCpuSystem) els.sysCpuSystem.textContent = `Kernel: ${system.cpuSystemMs ?? 0} ms`;
  if (els.sysUptime) els.sysUptime.textContent = formatDuration(system.uptimeSeconds ?? 0);
  if (els.sysNodeVersion) els.sysNodeVersion.textContent = system.nodeVersion || "-";
}
function renderTableRows(container, rows, rowRenderer, colspan, emptyText) {
  if (!container) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    container.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${emptyText}</td></tr>`;
    return;
  }
  container.innerHTML = list.map(rowRenderer).join("");
}
function formatLatency(ms) {
  if (ms == null || Number.isNaN(ms)) return "\u2014";
  if (ms < 1e3) return `${Math.round(ms)} ms`;
  const s = ms / 1e3;
  if (s < 60) return `${Math.round(s * 10) / 10} s`;
  return `${Math.round(s / 60 * 10) / 10} min`;
}
function formatAvgLabel(ms) {
  if (ms == null) return "Avg n/a";
  return `Avg ${formatLatency(ms)}`;
}
function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function renderRubricTable(rubricText) {
  if (!rubricText) return "";
  const t = rubricText.trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria) && p.criteria.length > 0) {
        const levels = p.criteria[0].levels;
        return `
          <table class="rubrik-display">
            <thead>
              <tr>
                <th>Kriteria</th>
                <th>Bobot</th>
                ${levels.map((l) => `<th class="rubrik-lev-${l.score}">${escapeHtml(l.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${p.criteria.map((c) => `
                <tr>
                  <td><strong>${escapeHtml(c.name)}</strong></td>
                  <td>${c.weight}%</td>
                  ${c.levels.map((l) => `<td class="rubrik-lev-${l.score}">${escapeHtml(l.descriptor || "\u2014")}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    } catch {
    }
  }
  const criteria = parseRubricToCriteria(t);
  if (criteria && criteria.length && criteria.some((c) => c.name)) {
    return `
      <table class="rubrik-display">
        <thead>
          <tr>
            <th>Kriteria</th>
            <th>Bobot</th>
          </tr>
        </thead>
        <tbody>
          ${criteria.map(
      (c) => `
            <tr>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>${Number(c.weight) ? `${Number(c.weight)}%` : "\u2014"}</td>
            </tr>`
    ).join("")}
        </tbody>
      </table>`;
  }
  return `<pre style="white-space:pre-wrap;font-size:0.85rem;color:var(--muted);margin:0;">${escapeHtml(t)}</pre>`;
}
var EMPTY_SUBMISSIONS, EMPTY_TRENDS;
var init_render = __esm({
  "src/js/render.js"() {
    init_utils();
    init_competency_profile();
    init_dom();
    init_status();
    EMPTY_SUBMISSIONS = "Hasil akan muncul setelah siswa menyelesaikan penilaian.";
    EMPTY_TRENDS = "Belum ada tren skor.";
  }
});

// src/js/toast.js
function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }
  while (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstElementChild;
    if (oldest) oldest.remove();
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "error" ? "\u26A0\uFE0F" : type === "success" ? "\u2705" : "\u2139\uFE0F";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message" style="flex: 1;">${message}</span>
    <button class="toast-close" aria-label="Tutup notifikasi" title="Tutup">&times;</button>
  `;
  container.appendChild(toast);
  const removeToast = () => {
    if (toast.classList.contains("fade-out")) return;
    toast.classList.add("fade-out");
    toast.addEventListener("animationend", () => toast.remove());
  };
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", removeToast);
  setTimeout(removeToast, 5e3);
}
function showConfirmDialog(message, title = "Konfirmasi") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    if (!modal) {
      resolve(window.confirm(message));
      return;
    }
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const okBtn = document.getElementById("confirmModalOk");
    const cancelBtn = document.getElementById("confirmModalCancel");
    titleEl.textContent = title;
    msgEl.textContent = message;
    modal.classList.remove("hidden");
    const cleanup = () => {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
    };
    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onOk();
    };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
    cancelBtn.focus();
  });
}
var MAX_TOASTS;
var init_toast = __esm({
  "src/js/toast.js"() {
    MAX_TOASTS = 5;
    window.appAlert = function(msg) {
      showToast(msg, "error");
    };
    window.appSuccess = function(msg) {
      showToast(msg, "success");
    };
  }
});

// src/js/user-management.js
var user_management_exports = {};
__export(user_management_exports, {
  bindUserManagementEvents: () => bindUserManagementEvents,
  handleCreateUser: () => handleCreateUser,
  handleCsvUpload: () => handleCsvUpload,
  renderUsers: () => renderUsers
});
function bindUserManagementEvents(ctx) {
  const { els } = ctx;
  els.userForm.addEventListener("submit", (event) => handleCreateUser(ctx, event));
  els.csvForm.addEventListener("submit", (event) => handleCsvUpload(ctx, event));
  if (els.selectAllUsers) {
    els.selectAllUsers.checked = false;
    els.selectAllUsers.addEventListener("change", () => {
      const checked = els.selectAllUsers.checked;
      [...els.userList.querySelectorAll(".select-user")].forEach((cb) => cb.checked = checked);
    });
  }
  els.userList.addEventListener("click", async (event) => {
    const article = event.target.closest("article");
    if (!article) return;
    const id = article.dataset.id;
    if (event.target.classList.contains("edit-user")) {
      const currentUser = ctx.users.find((u) => u.id === id);
      if (!currentUser) return;
      const newRole = prompt(`Ubah role untuk ${currentUser.name} (student/teacher/admin):`, currentUser.role);
      if (newRole && ["student", "teacher", "admin"].includes(newRole) && newRole !== currentUser.role) {
        await updateUser(id, { role: newRole });
        ctx.users = await loadUsers(ctx);
        renderUsers(ctx);
      } else if (newRole) {
        showToast("Role tidak valid. Harus student, teacher, atau admin.");
      }
    } else if (event.target.classList.contains("delete-user")) {
      if (!await showConfirmDialog("Hapus user ini?", "Hapus User")) return;
      await deleteUser(id);
      ctx.users = await loadUsers(ctx);
      renderUsers(ctx);
    }
  });
  if (els.deleteSelectedUsers) {
    els.deleteSelectedUsers.addEventListener("click", async () => {
      const selected = [...els.userList.querySelectorAll(".select-user:checked")].map((cb) => cb.dataset.id);
      if (!selected.length) {
        showToast("Pilih akun terlebih dahulu", "error");
        return;
      }
      if (!await showConfirmDialog(`Hapus ${selected.length} akun terpilih? Tindakan ini tidak bisa dibatalkan.`, "Hapus Akun")) return;
      els.deleteSelectedUsers.disabled = true;
      try {
        const results = { success: [], errors: [] };
        for (const id of selected) {
          try {
            await deleteUser(id);
            results.success.push(id);
          } catch (err) {
            results.errors.push({ id, message: err.message || String(err) });
          }
        }
        if (results.success.length) {
          ctx.users = await loadUsers(ctx);
          renderUsers(ctx);
          refreshSimulatorIfEnabled(ctx);
        }
        if (results.errors.length) {
          showToast(`Selesai. Berhasil: ${results.success.length}. Gagal: ${results.errors.length}`, "error");
        } else {
          showToast(`Berhasil menghapus ${results.success.length} akun.`, "success");
        }
      } finally {
        els.deleteSelectedUsers.disabled = false;
      }
    });
  }
}
async function handleCreateUser(ctx, event) {
  event.preventDefault();
  const { els } = ctx;
  setButtonLoading(event.submitter, true, "Membuat akun...", "Buat akun");
  try {
    const user = await createUser({
      name: els.userName.value,
      email: els.userEmail.value,
      password: els.userPassword.value,
      role: els.userRole.value
    });
    ctx.users.unshift(user);
    els.userForm.reset();
    renderUsers(ctx);
    refreshSimulatorIfEnabled(ctx);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(event.submitter, false, "Membuat akun...", "Buat akun");
  }
}
async function handleCsvUpload(ctx, event) {
  event.preventDefault();
  const { els } = ctx;
  const file = els.csvFile.files[0];
  if (!file) return;
  setButtonLoading(event.submitter, true, "Memproses...", "Upload & Proses CSV");
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const payload = lines.map((line) => {
      const [name, email, role, password] = line.split(",").map((item) => item.trim());
      return { name, email, role, password };
    });
    if (payload.length === 0) {
      throw new Error("File CSV kosong atau format tidak valid");
    }
    const response = await createUsersBatch(payload);
    if (response.success && response.success.length > 0) {
      ctx.users.unshift(...response.success);
      renderUsers(ctx);
      refreshSimulatorIfEnabled(ctx);
    }
    const successCount = response.success ? response.success.length : 0;
    const errorCount = response.errors ? response.errors.length : 0;
    if (errorCount === 0) {
      showToast(`Berhasil membuat ${successCount} akun baru dari CSV.`, "success");
      els.csvForm.reset();
    } else {
      const errMsg = response.errors[0]?.message || "Beberapa baris gagal";
      showToast(`Selesai. Sukses: ${successCount}. Gagal: ${errorCount} (${errMsg})`, "error");
      els.csvForm.reset();
    }
  } catch (error) {
    showToast(error.message || "Gagal memproses file CSV", "error");
  } finally {
    setButtonLoading(event.submitter, false, "Memproses...", "Upload & Crop CSV");
  }
}
function renderUsers(ctx) {
  const { els, auth } = ctx;
  if (auth.user?.role !== "admin") return;
  const extraUsers = ctx.users.filter((user) => user.id !== auth.user.id);
  if (!extraUsers.length) {
    els.userList.className = "list-stack empty-state";
    els.userList.textContent = "Belum ada akun tambahan.";
    return;
  }
  els.userList.className = "list-stack";
  els.userList.innerHTML = extraUsers.map((user) => `
    <article class="list-item" data-id="${user.id}">
      <div style="flex: 1; min-width: 0; display:flex; gap:12px; align-items:center;">
        <input type="checkbox" class="select-user" data-id="${user.id}" aria-label="Pilih user" />
        <div style="flex:1; min-width:0;">
          <strong>${escapeHtml(user.name)}</strong>
          <p>${escapeHtml(user.email)}</p>
        </div>
        <div class="item-actions">
          <button type="button" class="action-button edit-user">Ubah Role</button>
          <button type="button" class="action-button danger-button delete-user">Hapus</button>
        </div>
      </div>
      <span class="user-role">${escapeHtml(roleLabel(user.role))}</span>
    </article>
  `).join("");
}
var init_user_management = __esm({
  "src/js/user-management.js"() {
    init_api();
    init_dom();
    init_toast();
    init_utils();
    init_app_context();
  }
});

// src/js/class-management.js
var class_management_exports = {};
__export(class_management_exports, {
  bindClassManagementEvents: () => bindClassManagementEvents,
  renderClasses: () => renderClasses
});
function bindClassManagementEvents(ctx) {
  const { els } = ctx;
  els.classForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = els.classNameInput.value.trim();
    if (!name) return;
    const classroom = await createClassroom(name);
    ctx.state.classes.unshift({ ...classroom, status: "teacher" });
    els.classForm.reset();
    await renderCurrentState2(ctx);
  });
  els.joinClassForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = els.joinCode.value.trim();
    if (!code) return;
    await joinClass(code);
    await reloadState(ctx);
    els.joinClassForm.reset();
    await renderCurrentState2(ctx);
    showToast("Request join terkirim. Tunggu approval guru.");
  });
  els.studentJoinClassForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = els.studentJoinCode.value.trim();
    if (!code) return;
    await joinClass(code);
    await reloadState(ctx);
    els.studentJoinClassForm.reset();
    await renderCurrentState2(ctx);
    showToast("Request join terkirim. Tunggu approval guru.");
  });
  els.pendingJoinList.addEventListener("click", async (event) => {
    const id = event.target.dataset.id;
    if (!id) return;
    if (event.target.classList.contains("approve-join")) {
      await approveJoinRequest(id);
    } else if (event.target.classList.contains("reject-join")) {
      await updateMembership(id, "rejected");
    } else return;
    await reloadState(ctx);
    await renderCurrentState2(ctx);
  });
  if (els.approvedMemberList) {
    els.approvedMemberList.addEventListener("click", async (event) => {
      const id = event.target.dataset.id;
      if (!id || !event.target.classList.contains("remove-member")) return;
      if (!await showConfirmDialog("Keluarkan siswa dari kelas ini?", "Hapus Anggota")) return;
      await deleteMembership(id);
      await reloadState(ctx);
      await renderCurrentState2(ctx);
    });
  }
  if (els.memberSearchInput) {
    els.memberSearchInput.addEventListener("input", (event) => {
      ctx.memberSearchQuery = event.target.value;
      ctx.memberCurrentPage = 1;
      renderClasses(ctx);
    });
  }
  if (els.memberPrevBtn) {
    els.memberPrevBtn.addEventListener("click", () => {
      if (ctx.memberCurrentPage > 1) {
        ctx.memberCurrentPage--;
        renderClasses(ctx);
        els.approvedMemberList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
  if (els.memberNextBtn) {
    els.memberNextBtn.addEventListener("click", () => {
      const approved = ctx.state.memberships.filter((item) => item.status === "approved");
      const filtered = ctx.memberSearchQuery.trim() === "" ? approved : approved.filter((item) => {
        const searchLower = ctx.memberSearchQuery.toLowerCase();
        return item.student_name.toLowerCase().includes(searchLower) || item.student_email.toLowerCase().includes(searchLower);
      });
      const totalPages = Math.ceil(filtered.length / ctx.MEMBERS_PER_PAGE);
      if (ctx.memberCurrentPage < totalPages) {
        ctx.memberCurrentPage++;
        renderClasses(ctx);
        els.approvedMemberList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
  els.classList.addEventListener("click", async (event) => {
    const article = event.target.closest("article");
    if (!article) return;
    const id = article.dataset.id;
    if (event.target.classList.contains("edit-class")) {
      const currentName = ctx.state.classes.find((c) => c.id === id)?.name || "";
      const newName = prompt("Nama kelas baru:", currentName);
      if (newName && newName !== currentName) {
        await updateClassroom(id, { name: newName });
        await reloadState(ctx);
        await renderCurrentState2(ctx);
      }
    } else if (event.target.classList.contains("delete-class")) {
      if (!await showConfirmDialog("Hapus kelas beserta semua datanya?", "Hapus Kelas")) return;
      await deleteClassroom(id);
      await reloadState(ctx);
      await renderCurrentState2(ctx);
    }
  });
  if (els.bulkAddButton) {
    els.bulkAddButton.addEventListener("click", async () => {
      const classId = els.bulkAddClassSelect?.value;
      const raw = els.bulkAddEmails?.value || "";
      const emails = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!classId) return showToast("Pilih kelas tujuan terlebih dahulu", "error");
      if (!emails.length) return showToast("Masukkan minimal 1 email", "error");
      const { setButtonLoading: setButtonLoading2 } = await Promise.resolve().then(() => (init_dom(), dom_exports));
      setButtonLoading2(els.bulkAddButton, true, "Menambahkan...", "Tambahkan ke Kelas");
      try {
        const { addStudentsToClass: addStudentsToClass2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const resp = await addStudentsToClass2({ classId, emails });
        const addedCount = resp.added ? resp.added.length : 0;
        const errorCount = resp.errors ? resp.errors.length : 0;
        if (addedCount) {
          showToast(`Berhasil menambahkan ${addedCount} siswa.`, "success");
          await reloadState(ctx);
          await renderCurrentState2(ctx);
        }
        if (errorCount) {
          showToast(`Beberapa email gagal ditambahkan: ${errorCount}`, "error");
          console.warn("Bulk add errors", resp.errors);
        }
        els.bulkAddEmails.value = "";
      } catch (err) {
        showToast(err.message || "Gagal menambahkan siswa", "error");
      } finally {
        setButtonLoading2(els.bulkAddButton, false, "Menambahkan...", "Tambahkan ke Kelas");
      }
    });
    if (els.bulkAddClear) {
      els.bulkAddClear.addEventListener("click", () => {
        if (els.bulkAddEmails) els.bulkAddEmails.value = "";
      });
    }
  }
  if (els.bulkAddCsvUpload) {
    els.bulkAddCsvUpload.addEventListener("click", async () => {
      const file = els.bulkAddCsvFile.files[0];
      if (!file) return showToast("Pilih file CSV terlebih dahulu", "error");
      const { setButtonLoading: setButtonLoading2 } = await Promise.resolve().then(() => (init_dom(), dom_exports));
      setButtonLoading2(els.bulkAddCsvUpload, true, "Mengunggah...", "Upload CSV");
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const parsed = lines.map((line, idx) => {
          const parts = line.split(",").map((item) => item.trim());
          return { name: parts[0] || "", email: parts[1] || "", password: parts[2] || "", row: idx + 1 };
        });
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const valid = [];
        const invalid = [];
        for (const p of parsed) {
          const errs = [];
          if (!p.name) errs.push("Nama kosong");
          if (!emailRe.test(p.email)) errs.push("Email tidak valid");
          if (!p.password || p.password.length < 8) errs.push("Password minimal 8 karakter");
          if (errs.length) invalid.push({ row: p.row, email: p.email, errors: errs });
          else valid.push(p);
        }
        if (invalid.length) {
          const sample = invalid.slice(0, 5).map((i) => `Baris ${i.row}: ${i.email} (${i.errors.join("; ")})`).join("\n");
          const proceed = await showConfirmDialog(`Ditemukan ${invalid.length} baris bermasalah. Contoh:
${sample}

Lanjutkan dan lewati baris bermasalah?`, "Baris Bermasalah");
          if (!proceed) {
            setButtonLoading2(els.bulkAddCsvUpload, false, "Mengunggah...", "Upload CSV");
            return;
          }
        }
        const payload = valid.map(({ name, email, password }) => ({ name, email, password }));
        const classId = els.bulkAddClassSelect?.value;
        if (!classId) return showToast("Pilih kelas terlebih dahulu", "error");
        const { createStudentsBatch: createStudentsBatch2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const resp = await createStudentsBatch2({ classId, users: payload });
        const added = resp.added ? resp.added.length : 0;
        const errors = resp.errors ? resp.errors.length : 0;
        if (added) {
          showToast(`Berhasil menambahkan ${added} siswa.`, "success");
          await reloadState(ctx);
          await renderCurrentState2(ctx);
        }
        if (errors) showToast(`Selesai. Gagal: ${errors}`, "error");
        els.bulkAddCsvFile.value = null;
      } catch (err) {
        showToast(err.message || "Gagal mengunggah CSV", "error");
      } finally {
        setButtonLoading2(els.bulkAddCsvUpload, false, "Mengunggah...", "Upload CSV");
      }
    });
  }
}
function renderClasses(ctx) {
  const { els } = ctx;
  const isStudent = ctx.auth.user?.role === "student";
  els.classForm.classList.toggle("hidden", isStudent);
  els.joinClassForm.classList.toggle("hidden", !isStudent);
  els.pendingJoinList.classList.toggle("hidden", isStudent);
  const usableClasses = ctx.state.classes.filter((item) => !isStudent || item.status === "approved");
  els.classSelect.innerHTML = usableClasses.length ? usableClasses.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("") : `<option value="">Belum ada kelas</option>`;
  if (els.monitorClassFilter && !isStudent) {
    const currentVal = els.monitorClassFilter.value;
    els.monitorClassFilter.innerHTML = `<option value="">Semua Kelas</option>` + ctx.state.classes.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    if (currentVal && ctx.state.classes.some((c) => c.id === currentVal)) {
      els.monitorClassFilter.value = currentVal;
    }
  }
  if (!ctx.state.classes.length) {
    els.classList.className = "list-stack empty-state";
    els.classList.textContent = isStudent ? "Belum join kelas." : "Belum ada kelas.";
  } else {
    els.classList.className = "list-stack";
    els.classList.innerHTML = ctx.state.classes.map((item) => `
      <article class="submission-item" data-id="${escapeHtml(item.id)}">
        <div style="flex: 1; min-width: 0;">
          <strong>${escapeHtml(item.name)}</strong>
          <p>Kode: <b>${escapeHtml(item.join_code || item.joinCode || "-")}</b></p>
          ${!isStudent ? `
            <div class="item-actions">
              <button type="button" class="action-button edit-class">Edit</button>
              <button type="button" class="action-button danger-button delete-class">Hapus</button>
            </div>
          ` : ""}
        </div>
      </article>
    `).join("");
  }
  if (isStudent) {
    const activeClasses = ctx.state.classes.filter((c) => c.status === "approved" || c.status === "pending");
    if (!activeClasses.length) {
      els.studentClassList.className = "list-stack empty-state";
      els.studentClassList.textContent = "Belum join kelas.";
    } else {
      els.studentClassList.className = "list-stack";
      els.studentClassList.innerHTML = activeClasses.map((item) => `
        <article class="list-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>Status: ${item.status === "approved" ? "Disetujui" : "Menunggu"}</p>
          </div>
        </article>
      `).join("");
    }
    if (els.studentClassFilter) {
      const approvedClasses = activeClasses.filter((c) => c.status === "approved");
      const currentVal = els.studentClassFilter.value;
      els.studentClassFilter.innerHTML = `<option value="">Semua Kelas</option>` + approvedClasses.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
      if (currentVal && approvedClasses.some((c) => c.id === currentVal)) {
        els.studentClassFilter.value = currentVal;
      }
    }
  }
  if (els.approvedMemberList) els.approvedMemberList.classList.toggle("hidden", isStudent);
  const pending = ctx.state.memberships.filter((item) => item.status === "pending");
  if (!pending.length) {
    els.pendingJoinList.className = "list-stack empty-state";
    els.pendingJoinList.textContent = "Belum ada request join.";
  } else {
    els.pendingJoinList.className = "list-stack";
    els.pendingJoinList.innerHTML = pending.map((item) => `
      <article class="list-item">
        <div>
          <strong>${escapeHtml(item.student_name)}</strong>
          <p>${escapeHtml(item.student_email)} - ${escapeHtml(item.class_name)}</p>
        </div>
        <div class="item-actions">
          <button class="secondary-button approve-join" data-id="${escapeHtml(item.id)}" type="button">Approve</button>
          <button class="action-button danger-button reject-join" data-id="${escapeHtml(item.id)}" type="button">Tolak</button>
        </div>
      </article>
    `).join("");
  }
  if (els.approvedMemberList) {
    const approved = ctx.state.memberships.filter((item) => item.status === "approved");
    const filtered = ctx.memberSearchQuery.trim() === "" ? approved : approved.filter((item) => {
      const searchLower = ctx.memberSearchQuery.toLowerCase();
      return item.student_name.toLowerCase().includes(searchLower) || item.student_email.toLowerCase().includes(searchLower);
    });
    if (els.memberCountText) {
      els.memberCountText.textContent = `${filtered.length} anggota`;
    }
    if (!filtered.length) {
      els.approvedMemberList.className = "list-stack empty-state";
      els.approvedMemberList.textContent = ctx.memberSearchQuery.trim() === "" ? "Belum ada anggota." : "Tidak ada hasil pencarian.";
      if (els.memberPaginationContainer) {
        els.memberPaginationContainer.style.display = "none";
      }
    } else {
      const totalPages = Math.ceil(filtered.length / ctx.MEMBERS_PER_PAGE);
      if (ctx.memberCurrentPage > totalPages) {
        ctx.memberCurrentPage = Math.max(1, totalPages);
      }
      const startIdx = (ctx.memberCurrentPage - 1) * ctx.MEMBERS_PER_PAGE;
      const endIdx = startIdx + ctx.MEMBERS_PER_PAGE;
      const pageItems = filtered.slice(startIdx, endIdx);
      els.approvedMemberList.className = "list-stack";
      els.approvedMemberList.innerHTML = pageItems.map((item) => `
        <article class="list-item">
          <div>
            <strong>${escapeHtml(item.student_name)}</strong>
            <p>${escapeHtml(item.student_email)}</p>
            <p style="font-size: 0.85rem; color: var(--muted); margin-top: 4px;">${escapeHtml(item.class_name)}</p>
            <div class="item-actions">
              <button class="action-button danger-button remove-member" data-id="${escapeHtml(item.id)}" type="button">Keluarkan</button>
            </div>
          </div>
        </article>
      `).join("");
      if (els.memberPaginationContainer) {
        if (totalPages <= 1) {
          els.memberPaginationContainer.style.display = "none";
        } else {
          els.memberPaginationContainer.style.display = "flex";
          els.memberPrevBtn.disabled = ctx.memberCurrentPage === 1;
          els.memberNextBtn.disabled = ctx.memberCurrentPage === totalPages;
          els.memberPageInfo.textContent = `Halaman ${ctx.memberCurrentPage} dari ${totalPages}`;
        }
      }
    }
  }
  if (els.bulkAddClassSelect) {
    const classOptions = ctx.state.classes.map((c) => ({ id: c.id, name: c.name }));
    els.bulkAddClassSelect.innerHTML = `<option value="">Pilih kelas</option>` + classOptions.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
  }
}
async function reloadState(ctx) {
  const { loadState: loadState2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const nextState = await loadState2();
  ctx.state.classes = nextState.classes;
  ctx.state.memberships = nextState.memberships;
  ctx.state.assessments = nextState.assessments;
}
var init_class_management = __esm({
  "src/js/class-management.js"() {
    init_api();
    init_toast();
    init_utils();
    init_app_context();
  }
});

// src/js/assessment-factory.js
function readAssessmentForm(els) {
  return {
    id: uid("assess"),
    topic: els.topic.value.trim(),
    outcomes: els.outcomes.value.trim(),
    rubric: "",
    difficulty: els.difficulty.value,
    examples: els.examples.value.trim(),
    classId: els.classSelect.value,
    status: "published",
    count: Number(els.questionCount.value),
    timeLimit: Number(els.timeLimit.value || 0),
    oralExamEnabled: els.oralExamEnabled.checked,
    disableManualTyping: els.disableManualTyping.checked,
    allowRetakes: els.allowRetakes.checked,
    maxAttempts: Number(els.maxAttempts?.value || 0),
    isTryout: els.isTryout ? els.isTryout.checked : false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function createAssessment(config, questions = []) {
  const { count, rubric, ...assessment } = config;
  const derived = (questions || []).map((q) => String(q.rubric || "").trim()).filter((r) => r.length > 0);
  return {
    ...assessment,
    rubric: String(rubric || "").trim() || derived.join("\n"),
    questions: questions || []
  };
}
function createSubmission({
  assessment,
  studentName,
  finalScore,
  questionScores,
  feedback,
  status = "EVALUATED",
  verification = null,
  criteria = [],
  evaluationRunId = null,
  evaluationId = null,
  evaluationSource = "ai",
  insight = ""
}) {
  return {
    id: uid("sub"),
    assessmentId: assessment.id,
    assessmentTitle: assessment.topic,
    classId: assessment.classId,
    studentName,
    submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
    finalScore,
    questionScores,
    feedback,
    // Trustworthy-assessment metadata (PRD: score-state semantics must be explicit).
    status,
    verification,
    criteria,
    evaluationRunId,
    evaluationId,
    evaluationSource,
    insight
  };
}
var init_assessment_factory = __esm({
  "src/js/assessment-factory.js"() {
    init_utils();
  }
});

// src/js/fallback-assessment.js
function inferFallbackCriteria(prompt2, keyword) {
  const text = String(prompt2 || "");
  const criteria = [];
  const base = /\b(?:jelaskan|pengertian|konsep|pemahaman|uraikan|terangkan)\b/i.test(text) ? `Ketepatan menjelaskan konsep ${keyword}` : `Ketepatan memahami ${keyword}`;
  criteria.push(base);
  for (const demand of DEMANDS) {
    if (!demand.pattern.test(text)) continue;
    const name = demand.type === "reasoning" ? `Kualitas ${demand.label}` : `Kesesuaian ${demand.label}`;
    if (!criteria.includes(name)) criteria.push(name);
  }
  return criteria.slice(0, 3);
}
function buildFallbackRubric(criteria) {
  if (!criteria.length) return "";
  const rawWeights = criteria.length === 1 ? [100] : criteria.map(() => 100 / criteria.length);
  return criteria.map((name, index) => `${name}: ${Number(rawWeights[index].toFixed(2))}%`).join("\n");
}
function generateFallbackQuestions({ topic, outcomes, rubric, difficulty, examples, count }) {
  const keywords = getKeywords(topic, outcomes, rubric, examples);
  const core = keywords.length ? keywords : FALLBACK_KEYWORDS;
  const stems = FALLBACK_QUESTION_STEMS[difficulty] || FALLBACK_QUESTION_STEMS.Menengah;
  return Array.from({ length: count }, (_, index) => {
    const keyword = core[index % core.length];
    const prompt2 = stems[index % stems.length].replaceAll("{topic}", topic).replaceAll("{keyword}", keyword);
    const criteria = inferFallbackCriteria(prompt2, keyword);
    const questionRubric = buildFallbackRubric(criteria);
    return {
      id: uid("q"),
      prompt: prompt2,
      focus: keyword,
      outcome: `Siswa mampu menjelaskan konsep ${keyword} pada materi ${topic} dengan bahasa sendiri.`,
      criteria,
      rubric: questionRubric,
      ideal: `Jawaban kuat menunjukkan pemahaman ${keyword}${criteria.length > 1 ? ", disertai evidence sesuai tuntutan pertanyaan" : ""} dan mengaitkannya dengan ${topic}.`
    };
  });
}
function generateProbingFallback({ prompt: prompt2, answer, focus = "", topic = "" }) {
  const text = String(answer || "").trim();
  const focusName = String(focus || topic || "topik").trim();
  if (!text) {
    return {
      prompt: `Karena jawaban kosong, jelaskan minimal satu ide utama yang kamu pahami tentang ${focusName}, lalu beri satu alasan mengapa itu penting.`,
      focus: focusName
    };
  }
  const mentionsReason = /\b(karena|sebab|akibat|mengapa|alasan|jadi)\b/i.test(text);
  const hasExample = /\b(contoh|misal|seperti|misalnya|ilustrasi)\b/i.test(text);
  if (!hasExample) {
    return {
      prompt: `Kamu menyebutkan "${truncateAnswer(text)}". Berikan satu contoh nyata yang menggambarkan hal itu, lalu jelaskan kaitannya dengan ${focusName}.`,
      focus: focusName
    };
  }
  if (!mentionsReason) {
    return {
      prompt: `Kamu menyebutkan "${truncateAnswer(text)}". Jelaskan alasan atau sebab-akibat di balik itu menurut pemahamanmu.`,
      focus: focusName
    };
  }
  return {
    prompt: `Dari jawabanmu ("${truncateAnswer(text)}"), bandingkan dengan situasi atau sudut pandang lain, lalu simpulkan mana yang lebih tepat menurutmu dan mengapa.`,
    focus: focusName
  };
}
function truncateAnswer(text) {
  const t = String(text || "").trim();
  return t.length > 90 ? `${t.slice(0, 90)}\u2026` : t;
}
function recommendFallbackConfig(topic, difficulty = "Menengah") {
  return {
    outcomes: [
      `Siswa mampu menjelaskan konsep utama pada materi ${topic} dengan bahasa sendiri.`,
      `Siswa mampu menghubungkan konsep ${topic} dengan contoh atau situasi nyata yang relevan.`,
      `Siswa mampu menyampaikan alasan, bukti, atau proses berpikir secara runtut dalam jawaban lisan tingkat ${difficulty.toLowerCase()}.`
    ].join("\n")
  };
}
function evaluateFallbackAssessment(assessment, answers, studentName, makeSubmission) {
  const questionScores = assessment.questions.map((question, index) => {
    const answerObj = answers[index];
    const rawAnswer = typeof answerObj === "string" ? answerObj : answerObj?.text || "";
    const answer = rawAnswer.toLowerCase();
    const words = answer.split(/\s+/).filter(Boolean);
    const questionRubric = question.rubric || assessment.rubric;
    const questionOutcome = question.outcome || assessment.outcomes;
    const rubricKeywords = getKeywords(questionRubric, questionOutcome, assessment.topic);
    const matched = rubricKeywords.filter((keyword) => answer.includes(keyword.toLowerCase()));
    const focusMatched = answer.includes(question.focus.toLowerCase());
    const lengthScore = Math.min(words.length / 55, 1) * 32;
    const keywordScore = Math.min(matched.length / Math.max(rubricKeywords.length, 1), 1) * 38;
    const reasoningScore = /(karena|sebab|contoh|misalnya|akibat|sehingga|dibanding)/i.test(answer) ? 20 : 8;
    const focusScore = focusMatched ? 10 : 2;
    const score = Math.round(Math.min(100, lengthScore + keywordScore + reasoningScore + focusScore));
    return {
      question: question.prompt,
      focus: question.focus,
      answer: rawAnswer,
      audio: typeof answerObj === "string" ? null : answerObj?.audio || null,
      duration: typeof answerObj === "string" ? 0 : answerObj?.duration || 0,
      score,
      matched,
      strengths: buildStrengths(score, matched, focusMatched),
      gaps: buildGaps(score, matched, rubricKeywords, question.focus)
    };
  });
  const finalScore = Math.round(questionScores.reduce((sum, item) => sum + item.score, 0) / questionScores.length);
  return makeSubmission({
    assessment,
    studentName,
    finalScore,
    questionScores,
    feedback: buildPersonalFeedback(finalScore)
  });
}
function buildStrengths(score, matched, focusMatched) {
  const strengths = [];
  if (score >= 70) strengths.push("Jawaban menunjukkan pemahaman konsep yang cukup kuat.");
  if (matched.length) strengths.push(`Istilah kunci yang muncul: ${matched.slice(0, 4).join(", ")}.`);
  if (focusMatched) strengths.push("Fokus pertanyaan terjawab secara eksplisit.");
  return strengths.length ? strengths : ["Jawaban sudah memberi dasar untuk dianalisis lebih lanjut."];
}
function buildGaps(score, matched, rubricKeywords, focus) {
  const missing = rubricKeywords.filter((keyword) => !matched.includes(keyword)).slice(0, 3);
  const gaps = [];
  if (score < 70) gaps.push("Tambahkan alasan, hubungan konsep, dan contoh konkret agar jawaban lebih utuh.");
  if (missing.length) gaps.push(`Pertimbangkan memasukkan konsep: ${missing.join(", ")}.`);
  if (!matched.includes(focus)) gaps.push(`Perjelas bagian yang berkaitan langsung dengan ${focus}.`);
  return gaps;
}
function buildPersonalFeedback(score) {
  if (score >= 85) return "Pemahaman sangat baik. Langkah berikutnya adalah membuat argumen lebih kritis dan mengantisipasi miskonsepsi.";
  if (score >= 70) return "Pemahaman sudah cukup solid. Perkuat jawaban dengan contoh yang lebih spesifik dan hubungan antar konsep.";
  if (score >= 55) return "Dasar pemahaman mulai terlihat. Fokus pada istilah kunci, urutan penjelasan, dan alasan sebab-akibat.";
  return "Perlu penguatan konsep dasar. Coba ulangi materi inti, lalu jawab dengan pola definisi, alasan, dan contoh.";
}
var DEMANDS;
var init_fallback_assessment = __esm({
  "src/js/fallback-assessment.js"() {
    init_config();
    init_utils();
    DEMANDS = [
      { type: "reasoning", pattern: /\b(?:mengapa|kenapa|alasan|jelaskan\s+(?:mengapa|alasan|hubungan|proses)|argumen|argumentasi|sebab|akibat|konsekuensi)\b/i, label: "penalaran sebab-akibat" },
      { type: "application", pattern: /\b(?:contoh|misal|misalnya|penerapan|diterapkan|kasus|situasi|gunakan)\b/i, label: "penerapan/contoh" },
      { type: "comparison", pattern: /\b(?:bandingkan|perbandingan|persamaan|perbedaan)\b/i, label: "perbandingan" },
      { type: "analysis", pattern: /\b(?:analisis|analisa|hubungan|dampak|pengaruh|keterkaitan)\b/i, label: "analisis" },
      { type: "evaluation", pattern: /\b(?:evaluasi|nilai|menilai|kritik|kelemahan|kelebihan|keterbatasan)\b/i, label: "evaluasi" },
      { type: "identification", pattern: /\b(?:sebutkan|identifikasi|tentukan|nama(?:kan)?)\b/i, label: "identifikasi" }
    ];
  }
});

// src/js/question-bank.js
var question_bank_exports = {};
__export(question_bank_exports, {
  bindQuestionBankEvents: () => bindQuestionBankEvents,
  loadQuestionBank: () => loadQuestionBank,
  saveCurrentQuestionsToBank: () => saveCurrentQuestionsToBank
});
function bindQuestionBankEvents(ctx) {
  const { els } = ctx;
  els.questionBankFilter.addEventListener("input", () => {
    loadQuestionBank(ctx);
  });
  els.questionBankImportBtn.addEventListener("click", () => {
    switchView(ctx, "teacherView");
  });
  els.questionBankList.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".delete-question-btn");
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const proceed = await showConfirmDialog("Hapus soal dari bank soal?", "Hapus Soal");
      if (!proceed) return;
      try {
        await deleteQuestionFromBank(id);
        showToast("Soal dihapus dari bank", "success");
        await loadQuestionBank(ctx);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    const importBtn = event.target.closest(".import-question-btn");
    if (importBtn) {
      const id = importBtn.dataset.id;
      const question = ctx._questionBankData?.find((q) => q.id === id);
      if (!question) return;
      ctx.pendingQuestions.push({
        id: `q-${Date.now()}-${ctx.pendingQuestions.length}`,
        prompt: question.prompt,
        focus: question.focus,
        outcome: question.outcome,
        rubric: question.rubric,
        ideal: question.ideal,
        criteria: question.criteria || []
      });
      const { renderQuestionEditor: renderQuestionEditor2 } = await Promise.resolve().then(() => (init_assessment_wizard(), assessment_wizard_exports));
      renderQuestionEditor2(ctx);
      showToast("Soal ditambahkan ke wizard", "success");
    }
  });
}
async function loadQuestionBank(ctx) {
  const { els } = ctx;
  const filter = els.questionBankFilter?.value?.trim() || "";
  try {
    const questions = await listQuestionBank(filter ? { topic: filter } : {});
    ctx._questionBankData = questions;
    els.questionBankCount.textContent = String(questions.length);
    if (!questions.length) {
      showEmpty(els.questionBankList, "list-stack empty-state", "Belum ada soal tersimpan. Simpan soal dari wizard penilaian.");
      return;
    }
    els.questionBankList.className = "list-stack";
    els.questionBankList.innerHTML = questions.map((q) => `
      <article class="feedback-card" style="position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;">
              <span class="tag badge-published">${escapeHtml(q.difficulty || "Umum")}</span>
              <span class="tag" style="background: var(--accent-light); color: var(--accent);">${escapeHtml(q.topic || "Tanpa topik")}</span>
            </div>
            <strong>${escapeHtml(q.prompt)}</strong>
            <p style="color: var(--muted); font-size: 0.9rem; margin-top: 6px;">
              Fokus: ${escapeHtml(q.focus)}${q.outcome ? ` \xB7 ${escapeHtml(q.outcome)}` : ""}
            </p>
            ${q.rubric ? `<div style="margin-top:8px;">${renderRubricTable(q.rubric)}</div>` : ""}
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button type="button" class="secondary-button import-question-btn" data-id="${q.id}" title="Gunakan soal ini di wizard">Gunakan</button>
            <button type="button" class="action-button danger-button delete-question-btn" data-id="${q.id}" aria-label="Hapus soal">&times;</button>
          </div>
        </div>
        <small style="color: var(--muted); display: block; margin-top: 8px; font-size: 0.8rem;">
          ${new Date(q.createdAt).toLocaleDateString("id-ID")}
        </small>
      </article>
    `).join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}
async function saveCurrentQuestionsToBank(ctx) {
  window.__lisanAssessmentWizardBridge?.sync?.();
  const config = ctx.pendingAssessmentConfig;
  if (!config || !ctx.pendingQuestions.length) {
    showToast("Tidak ada soal untuk disimpan", "error");
    return;
  }
  let saved = 0;
  for (const q of ctx.pendingQuestions) {
    try {
      await saveQuestionToBank({
        topic: config.topic || "",
        difficulty: config.difficulty || "",
        prompt: q.prompt,
        focus: q.focus,
        outcome: q.outcome,
        rubric: q.rubric,
        ideal: q.ideal,
        criteria: q.criteria
      });
      saved++;
    } catch (err) {
      showToast(`Gagal menyimpan soal: ${err.message}`, "error");
    }
  }
  showToast(`${saved} soal disimpan ke bank soal`, "success");
}
var init_question_bank = __esm({
  "src/js/question-bank.js"() {
    init_api();
    init_toast();
    init_dom();
    init_utils();
    init_app_context();
    init_render();
  }
});

// src/js/assessment-wizard-tail.js
function renderReviewSummary(ctx) {
  const { els } = ctx;
  if (!els.reviewSummary || !ctx.pendingAssessmentConfig) return;
  const config = ctx.pendingAssessmentConfig;
  const className = ctx.state.classes.find((c) => c.id === config.classId)?.name || "Kelas tidak dipilih";
  const answered = ctx.pendingQuestions.filter((q) => (q.prompt || "").trim()).length;
  const total = ctx.pendingQuestions.length;
  const timeLimit = Number(config.timeLimit) || 0;
  els.reviewSummary.innerHTML = `
    <div class="review-block"><h4>Konteks</h4><dl class="review-list">
      <div><dt>Topik</dt><dd>${escapeHtml(config.topic || "-")}</dd></div>
      <div><dt>Kelas</dt><dd>${escapeHtml(className)}</dd></div>
      <div><dt>Tingkat kesulitan</dt><dd>${escapeHtml(config.difficulty || "-")}</dd></div>
      <div><dt>Batas waktu per soal</dt><dd>${timeLimit > 0 ? formatTime(timeLimit) : "Tanpa batas"}</dd></div>
      <div><dt>Mode</dt><dd>${config.oralExamEnabled !== false ? "Ujian lisan" : "Tulisan"}${config.disableManualTyping ? " (typing dimatikan)" : ""}</dd></div>
      <div><dt>Retake</dt><dd>${config.allowRetakes ? "Diizinkan (tanpa batas)" : "Tidak diizinkan"}</dd></div>
      ${config.maxAttempts > 0 && !config.allowRetakes ? `<div><dt>Jumlah percobaan</dt><dd>${config.maxAttempts} kali</dd></div>` : ""}
    </dl></div>
    <div class="review-block"><h4>Soal</h4>
      <p class="review-count">${answered} dari ${total} soal sudah diisi.</p>
      ${renderAlignmentCoverage(ctx)}
      <ol class="review-questions">${ctx.pendingQuestions.map((q, i) => `<li class="${(q.prompt || "").trim() ? "" : "review-empty"}"><strong>Soal ${i + 1}</strong><span>${escapeHtml(compactText(q.prompt || "Belum diisi", 120))}</span>${q.probing ? `<span class="review-probing-badge">\u26A1 probing aktif</span>` : ""}</li>`).join("")}</ol>
    </div>`;
}
function parseRubricNames(text) {
  if (!text) return [];
  const t = String(text).trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria)) return p.criteria.map((c) => c.name || "").filter(Boolean);
    } catch {
    }
  }
  return t.split(/[;\n,]+/).map((s) => s.replace(/^\d+(\.\d+)?\s*%?\s*/, "").replace(/\s*[-:–]\s*(\d+(\.\d+)?\s*%?)?$/, "").replace(/\s*\(?\d+(\.\d+)?\s*%?\s*\)?$/, "").trim()).filter((s) => s.length > 2);
}
function normalizeCoverageKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function renderAlignmentCoverage(ctx) {
  const questions = ctx.pendingQuestions || [];
  const covered = new Set(questions.flatMap((q) => Array.isArray(q.criteria) ? q.criteria.map((c) => normalizeCoverageKey(typeof c === "string" ? c : c.name || c.id)) : []));
  const expected = [...new Set(questions.flatMap((q) => parseRubricNames(q.rubric)))];
  const uncovered = expected.filter((name) => !covered.has(normalizeCoverageKey(name)));
  if (!uncovered.length) return "";
  return `<p class="review-align-warning">\u26A0 Kriteria rubrik berikut belum diukur oleh soal manapun: <strong>${uncovered.map(escapeHtml).join("; ")}</strong>.</p>`;
}
function goToWizardStep(ctx, step) {
  const { els } = ctx;
  ctx.currentWizardStep = step;
  els.wizardPanels.forEach((panel) => panel.classList.toggle("hidden", Number(panel.dataset.wizardPanel) !== step));
  els.wizardSteps.forEach((btn) => {
    const active = Number(btn.dataset.wizardStep) === step;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.disabled = Number(btn.dataset.wizardStep) > step;
  });
  if (step === 3) renderReviewSummary(ctx);
}
async function fillRecommendedFields(ctx, target) {
  const { els } = ctx;
  const topic = els.topic.value.trim();
  if (!topic) {
    showToast("Isi topik atau materi terlebih dahulu.");
    els.topic.focus();
    return;
  }
  const button = els.recommendOutcomes;
  const defaultText = "Rekomendasikan kompetensi";
  try {
    button && (button.disabled = true);
    showRecommendStreamPlaceholder(ctx);
    const recommendation = await recommendConfigWithFallback(ctx, topic, els.difficulty.value);
    if (recommendation && (target === "outcomes" || target === "both")) els.outcomes.value = recommendation.outcomes || "";
    hideStreamPanel(ctx, els.recommendStreamPanel);
  } finally {
    if (button) button.disabled = false;
  }
}
async function recommendConfigWithFallback(ctx, topic, difficulty) {
  let raw = "";
  let recommendation = null;
  try {
    await streamAssessmentAction({ action: "recommend-assessment-config", payload: { topic, difficulty }, onChunk: (text) => {
      raw += text;
      renderRecommendStream(ctx, raw);
    }, onResult: (data) => {
      recommendation = data?.recommendation || null;
    } });
    return recommendation || recommendFallbackConfig(topic, difficulty);
  } catch (error) {
    showToast(`AI belum tersedia, memakai rekomendasi lokal. Detail: ${error.message}`);
    return recommendFallbackConfig(topic, difficulty);
  }
}
function showRecommendStreamPlaceholder(ctx) {
  const { els } = ctx;
  els.recommendStreamPlaceholder?.classList.remove("hidden");
  if (els.recommendStreamContent) els.recommendStreamContent.textContent = "";
  els.recommendStreamPanel?.classList.remove("hidden");
  ctx.recommendStreamShown = {};
}
function renderRecommendStream(ctx, raw) {
  const { els } = ctx;
  if (!els.recommendStreamContent) return;
  els.recommendStreamPlaceholder?.classList.add("hidden");
  const value = extractStreamedField(raw, "outcomes");
  ctx.recommendStreamShown = ctx.recommendStreamShown || {};
  if (value !== null) ctx.recommendStreamShown.outcomes = value;
  if (ctx.recommendStreamShown.outcomes !== void 0) {
    els.recommendStreamContent.textContent = `\u{1F4CB} Kompetensi:
${ctx.recommendStreamShown.outcomes}`;
    els.recommendStreamContent.scrollTop = els.recommendStreamContent.scrollHeight;
  }
}
function extractStreamedField(raw, field) {
  const keyIdx = String(raw || "").indexOf(`"${field}"`);
  if (keyIdx < 0) return null;
  let i = keyIdx + field.length + 2;
  while (i < raw.length && (raw[i] === " " || raw[i] === ":")) i++;
  if (raw[i] !== '"') return null;
  i++;
  let out = "";
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\") {
      const n = raw[++i];
      if (n === "n") out += "\n";
      else if (n === '"') out += '"';
      else if (n === "\\") out += "\\";
      else out += n || "";
    } else if (ch === '"') break;
    else out += ch;
  }
  return out;
}
async function generateQuestionsWithFallback(ctx, config) {
  let raw = "";
  let questions = null;
  try {
    await streamAssessmentAction({ action: "generate-questions", payload: config, onChunk: (text) => {
      raw += text;
      renderStreamedQuestionsFromRaw(ctx, raw);
    }, onResult: (data) => {
      questions = Array.isArray(data?.questions) ? data.questions : null;
    } });
    return questions;
  } catch (error) {
    showToast(`AI belum tersedia, memakai generator lokal. Detail: ${error.message}`);
    return generateFallbackQuestions(config);
  }
}
function renderStreamedQuestionsFromRaw(ctx, raw) {
  const { els } = ctx;
  if (!els.aiStreamQuestions) return;
  els.aiStreamPlaceholder?.classList.add("hidden");
  const trimmed = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return;
  try {
    const parsed = JSON.parse(match[0]);
    (Array.isArray(parsed.questions) ? parsed.questions : []).forEach((q, i) => renderStreamedQuestion(ctx, i, q));
  } catch {
  }
}
async function alignRubricWithFallback(ctx, config, questions) {
  let raw = "";
  let aligned = null;
  try {
    await streamAssessmentAction({ action: "align-rubric", payload: { config, questions }, onChunk: (text) => {
      raw += text;
      renderStreamedQuestionsFromRaw(ctx, raw);
    }, onResult: (data) => {
      aligned = Array.isArray(data?.questions) ? data.questions : null;
    } });
    return aligned || questions;
  } catch (error) {
    showToast(`AI belum tersedia, memakai alignment deterministik. Detail: ${error.message}`);
    return questions;
  }
}
function hideStreamPanel(ctx, panel) {
  panel?.classList.add("hidden");
}
function showQuestionStreamPlaceholder(ctx) {
  const { els } = ctx;
  els.aiStreamPlaceholder?.classList.remove("hidden");
  if (els.aiStreamQuestions) els.aiStreamQuestions.innerHTML = "";
  els.aiStreamPanel?.classList.remove("hidden");
  els.aiStreamPanel?.classList.remove("ai-stream-done");
}
function renderStreamedQuestion(ctx, index, question) {
  const { els } = ctx;
  const prompt2 = String(question?.prompt || "").trim();
  if (!els.aiStreamQuestions || !prompt2) return;
  let card = els.aiStreamQuestions.querySelector(`[data-q-index="${index}"]`);
  if (!card) {
    card = document.createElement("div");
    card.dataset.qIndex = index;
    els.aiStreamQuestions.appendChild(card);
  }
  card.className = "ai-stream-question";
  card.innerHTML = `<span class="ai-q-num">${index + 1}</span><span class="ai-q-text">${escapeHtml(prompt2)}</span>`;
}
function finishQuestionStream(ctx) {
  const { els } = ctx;
  els.aiStreamPanel?.classList.add("ai-stream-done");
  const first = els.aiStreamQuestions?.querySelector(".ai-stream-question");
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    first.classList.add("ai-stream-focus");
  }
}
function fillLevelDescriptors(name, levels) {
  const templates = [`${name || "Kriteria"} sangat baik, lengkap, dan tepat`, `${name || "Kriteria"} baik dan memadai`, `${name || "Kriteria"} cukup, namun masih perlu pengembangan`, `${name || "Kriteria"} kurang, perlu perbaikan signifikan`];
  return levels.map((l, i) => ({ ...l, descriptor: l.descriptor || templates[i] || "" }));
}
function parseRubricToCriteria2(text) {
  if (!text || !String(text).trim()) return [{ id: "c1", name: "", weight: 0, levels: fillLevelDescriptors("", structuredClone(DEFAULT_LEVELS2)) }];
  const t = String(text).trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria)) return p.criteria.map((c, i) => ({ id: c.id || `c${i + 1}`, name: c.name || "", weight: c.weight || 0, levels: fillLevelDescriptors(c.name || "", Array.isArray(c.levels) && c.levels.length === 4 ? c.levels : structuredClone(DEFAULT_LEVELS2)) }));
    } catch {
    }
  }
  const lines = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    if (["(", "[", "{"].includes(t[i])) depth++;
    else if ([")", "]", "}"].includes(t[i])) depth--;
    else if (depth === 0 && [",", ";", "\n"].includes(t[i])) {
      const seg = t.slice(start, i).trim();
      if (seg) lines.push(seg);
      start = i + 1;
    }
  }
  const last = t.slice(start).trim();
  if (last) lines.push(last);
  if (!lines.length) lines.push("");
  return lines.map((line, i) => {
    let name = line.replace(/^[•\-*]\s*/, "").replace(/[.!]+$/, "").trim();
    name = name.replace(/,\s*(?=\d+\s*%?$)/, " ").trim();
    let weight = 0;
    let m = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (m) {
      name = m[1].trim();
      weight = Number(m[2]);
    } else {
      m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/);
      if (m) {
        weight = Number(m[1]);
        name = m[2].trim();
      }
    }
    return { id: `c${i + 1}`, name, weight, levels: fillLevelDescriptors(name, structuredClone(DEFAULT_LEVELS2)) };
  });
}
function formatCriteriaToJson(criteria) {
  return JSON.stringify({ version: "2", criteria });
}
function renderRubrikBuilder(el, rubricText) {
  const criteria = parseRubricToCriteria2(rubricText);
  const levels = criteria[0]?.levels || DEFAULT_LEVELS2;
  el.dataset.ready = "1";
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong style="font-size:0.9rem;">Rubrik dengan Gradasi</strong><button type="button" class="secondary-button rubrik-add" style="padding:4px 12px;font-size:0.85rem;">+ Tambah Kriteria</button></div><div class="rubrik-gradation-wrap"><table class="rubrik-gradation"><thead><tr><th style="min-width:140px;">Kriteria</th><th style="min-width:40px;">Bobot</th>${levels.map((l) => `<th class="rubrik-level-${l.score}">${escapeHtml(l.label)} (${l.score})</th>`).join("")}<th style="width:32px;"></th></tr></thead><tbody class="rubrik-rows">${criteria.map((c, i) => rubrikGradationRow(c, i, levels)).join("")}</tbody></table></div><div class="rubrik-weight-sum" data-sum></div>`;
  el.querySelector(".rubrik-add")?.addEventListener("click", () => {
    const tbody = el.querySelector(".rubrik-rows");
    const idx = tbody.children.length;
    const row = document.createElement("tr");
    row.innerHTML = rubrikGradationRow({ id: `c${idx + 1}`, name: "", weight: 0, levels: structuredClone(DEFAULT_LEVELS2) }, idx, levels);
    tbody.appendChild(row);
    updateRubrik(el);
  });
  el.querySelector(".rubrik-rows")?.addEventListener("input", () => updateRubrik(el));
  el.querySelector(".rubrik-rows")?.addEventListener("click", (e) => {
    if (e.target.closest(".rubrik-delete")) {
      e.target.closest("tr").remove();
      updateRubrik(el);
    }
  });
  updateRubrik(el);
}
function rubrikGradationRow(c, idx, levels) {
  return `<tr class="rubrik-row"><td><input type="text" class="rubrik-name" placeholder="Nama kriteria" value="${escapeHtml(c.name || "")}" style="width:100%;" /></td><td><input type="number" class="rubrik-weight" min="0" max="100" step="1" value="${c.weight}" aria-label="Bobot %" style="width:50px;" />%</td>${levels.map((l, li) => `<td class="rubrik-level-cell rubrik-level-${l.score}"><textarea class="rubrik-desc" rows="2" placeholder="Deskripsi ${l.label.toLowerCase()}..." aria-label="${escapeHtml(l.label)}">${escapeHtml(c.levels?.[li]?.descriptor || "")}</textarea></td>`).join("")}<td><button type="button" class="action-button danger-button rubrik-delete" aria-label="Hapus">&times;</button></td></tr>`;
}
function updateRubrik(el) {
  const rows = [...el.querySelectorAll(".rubrik-rows tr")];
  const criteria = rows.map((r, i) => ({ id: `c${i + 1}`, name: r.querySelector(".rubrik-name")?.value.trim() || "", weight: Number(r.querySelector(".rubrik-weight")?.value || 0), levels: DEFAULT_LEVELS2.map((l, li) => ({ score: l.score, label: l.label, descriptor: r.querySelectorAll(".rubrik-desc")[li]?.value?.trim() || "" })) }));
  const sum = criteria.reduce((a, c) => a + (Number.isFinite(c.weight) ? c.weight : 0), 0);
  const sumEl = el.querySelector("[data-sum]");
  if (sumEl) {
    sumEl.textContent = `Total bobot: ${sum}% ${sum === 100 ? "\u2713" : sum > 100 ? "(kelebihan)" : "(kurang)"}`;
    sumEl.className = `rubrik-weight-sum ${sum === 100 ? "valid" : "invalid"}`;
  }
  const bridge = window.__lisanAssessmentWizardBridge;
  const qIndex = el.dataset.qIndex;
  if (bridge?.ctx && qIndex !== void 0 && bridge.ctx.pendingQuestions[qIndex]) bridge.ctx.pendingQuestions[qIndex].rubric = formatCriteriaToJson(criteria);
}
function convertLegacyRubricToJson(text) {
  if (!text || !String(text).trim()) return "";
  const t = String(text).trim();
  if (t.startsWith("{")) return t;
  try {
    return formatCriteriaToJson(parseRubricToCriteria2(t));
  } catch {
    return t;
  }
}
var DEFAULT_LEVELS2;
var init_assessment_wizard_tail = __esm({
  "src/js/assessment-wizard-tail.js"() {
    init_api();
    init_fallback_assessment();
    init_toast();
    init_utils();
    init_render();
    DEFAULT_LEVELS2 = [
      { score: 4, label: "Sangat Baik", descriptor: "" },
      { score: 3, label: "Baik", descriptor: "" },
      { score: 2, label: "Cukup", descriptor: "" },
      { score: 1, label: "Kurang", descriptor: "" }
    ];
  }
});

// src/js/assessment-wizard.js
var assessment_wizard_exports = {};
__export(assessment_wizard_exports, {
  bindAssessmentWizardEvents: () => bindAssessmentWizardEvents,
  handleAddManualQuestion: () => handleAddManualQuestion,
  handleAssessmentSubmit: () => handleAssessmentSubmit,
  handleCreateManualAssessment: () => handleCreateManualAssessment,
  handleDeleteQuestion: () => handleDeleteQuestion,
  improvePendingQuestionSet: () => improvePendingQuestionSet,
  renderQuestionEditor: () => renderQuestionEditor,
  savePendingQuestionSet: () => savePendingQuestionSet,
  syncQuestionsFromEditor: () => syncQuestionsFromEditor
});
function bindAssessmentWizardEvents(ctx) {
  _wizardCtx = ctx;
  window.__lisanAssessmentWizardBridge = {
    get ctx() {
      return _wizardCtx;
    },
    sync() {
      if (_wizardCtx) syncQuestionsFromEditor(_wizardCtx);
    },
    render() {
      if (_wizardCtx) renderQuestionEditor(_wizardCtx);
    }
  };
  const { els } = ctx;
  els.form.addEventListener("submit", (event) => handleAssessmentSubmit(ctx, event));
  if (els.createManualAssessment) els.createManualAssessment.addEventListener("click", (event) => handleCreateManualAssessment(ctx, event));
  els.saveQuestionSet.addEventListener("click", () => savePendingQuestionSet(ctx));
  if (els.addManualQuestion) els.addManualQuestion.addEventListener("click", () => handleAddManualQuestion(ctx));
  if (els.saveToBankBtn) els.saveToBankBtn.addEventListener("click", () => saveCurrentQuestionsToBank(ctx));
  els.editableQuestionList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".delete-question");
    if (deleteBtn) handleDeleteQuestion(ctx, Number(deleteBtn.dataset.index));
  });
  els.editableQuestionList.addEventListener("click", (event) => {
    const toggle = event.target.closest(".rubrik-builder-toggle");
    if (!toggle) return;
    const index = toggle.dataset.index;
    const builder = document.querySelector(`.rubrik-builder-${index}`);
    if (!builder) return;
    const isHidden = builder.style.display === "none" || !builder.style.display;
    builder.style.display = isHidden ? "grid" : "none";
    if (isHidden) {
      builder.dataset.qIndex = index;
      renderRubrikBuilder(builder, ctx.pendingQuestions[index]?.rubric || "");
    } else {
      const preview = toggle.closest("label")?.querySelector(".rubrik-preview");
      if (preview && ctx.pendingQuestions[index]?.rubric) preview.innerHTML = renderRubricTable(ctx.pendingQuestions[index].rubric);
    }
  });
  if (els.wizardToQuestions) els.wizardToQuestions.addEventListener("click", () => {
    const config = readAssessmentForm(els);
    if (!config.topic) {
      showToast("Isi topik atau materi terlebih dahulu.");
      els.topic.focus();
      return;
    }
    if (!config.outcomes) {
      showToast("Isi kompetensi / capaian pembelajaran terlebih dahulu.");
      els.outcomes.focus();
      return;
    }
    if (!config.classId) {
      showToast("Pilih kelas tujuan terlebih dahulu.");
      els.classSelect.focus();
      return;
    }
    ctx.pendingAssessmentConfig = config;
    goToWizardStep(ctx, 2);
  });
  if (els.wizardBackToContext) els.wizardBackToContext.addEventListener("click", () => goToWizardStep(ctx, 1));
  if (els.wizardToReview) els.wizardToReview.addEventListener("click", () => {
    if (!ctx.pendingAssessmentConfig) {
      showToast("Buat atau buka penilaian dulu sebelum meninjau.");
      return;
    }
    syncQuestionsFromEditor(ctx);
    goToWizardStep(ctx, 3);
  });
  if (els.wizardBackToQuestions) els.wizardBackToQuestions.addEventListener("click", () => goToWizardStep(ctx, 2));
  els.wizardSteps.forEach((btn) => btn.addEventListener("click", () => {
    const step = Number(btn.dataset.wizardStep);
    if (step <= ctx.currentWizardStep) goToWizardStep(ctx, step);
  }));
  if (els.editDisableManualTyping) els.editDisableManualTyping.addEventListener("change", (e) => {
    if (ctx.pendingAssessmentConfig) ctx.pendingAssessmentConfig.disableManualTyping = e.target.checked;
  });
  if (els.editOralExamEnabled) els.editOralExamEnabled.addEventListener("change", (e) => {
    if (ctx.pendingAssessmentConfig) ctx.pendingAssessmentConfig.oralExamEnabled = e.target.checked;
  });
  if (els.editAllowRetakes) els.editAllowRetakes.addEventListener("change", (e) => {
    if (ctx.pendingAssessmentConfig) ctx.pendingAssessmentConfig.allowRetakes = e.target.checked;
  });
  els.recommendOutcomes.addEventListener("click", () => fillRecommendedFields(ctx, "outcomes"));
}
async function handleAssessmentSubmit(ctx, event) {
  event.preventDefault();
  const { els } = ctx;
  const config = readAssessmentForm(els);
  if (!config.classId) {
    showToast("Pilih kelas tujuan terlebih dahulu.");
    return;
  }
  setButtonLoading(event.submitter, true, "Menghubungi AI...", "Buat soal dengan AI");
  showQuestionStreamPlaceholder(ctx);
  try {
    const questions = await generateQuestionsWithFallback(ctx, config);
    ctx.pendingAssessmentConfig = config;
    ctx.pendingQuestions = questions.map((q) => ({ ...q, rubric: q.rubric ? convertLegacyRubricToJson(q.rubric) : "" }));
    finishQuestionStream(ctx);
    await new Promise((resolve) => setTimeout(resolve, 600));
    hideStreamPanel(ctx, els.aiStreamPanel);
    renderQuestionEditor(ctx);
    goToWizardStep(ctx, 2);
  } finally {
    setButtonLoading(event.submitter, false, "Menghubungi AI...", "Buat soal dengan AI");
  }
}
function handleCreateManualAssessment(ctx) {
  const { els } = ctx;
  const config = readAssessmentForm(els);
  if (!config.classId) {
    showToast("Pilih kelas tujuan terlebih dahulu.");
    return;
  }
  ctx.pendingAssessmentConfig = config;
  const count = Math.max(1, Number(config.count) || 1);
  ctx.pendingQuestions = Array.from({ length: count }).map((_, i) => ({ id: `q-${i}`, prompt: "", focus: "", outcome: "", rubric: "", ideal: "" }));
  renderQuestionEditor(ctx);
  goToWizardStep(ctx, 2);
}
function handleAddManualQuestion(ctx) {
  if (!ctx.pendingAssessmentConfig) {
    showToast("Buat atau buka penilaian dulu sebelum menambah soal.");
    return;
  }
  syncQuestionsFromEditor(ctx);
  const idx = ctx.pendingQuestions.length;
  ctx.pendingQuestions.push({ id: `q-${idx}`, prompt: "", focus: "", outcome: "", rubric: "", ideal: "" });
  renderQuestionEditor(ctx);
}
function handleDeleteQuestion(ctx, index) {
  if (!ctx.pendingAssessmentConfig) {
    showToast("Buat atau buka penilaian dulu sebelum menghapus soal.");
    return;
  }
  if (ctx.pendingQuestions.length <= 1) {
    showToast("Minimal harus ada satu soal.");
    return;
  }
  if (index < 0 || index >= ctx.pendingQuestions.length) return;
  syncQuestionsFromEditor(ctx);
  ctx.pendingQuestions.splice(index, 1);
  renderQuestionEditor(ctx);
  showToast("Soal dihapus.");
}
async function savePendingQuestionSet(ctx) {
  const { els } = ctx;
  if (!ctx.pendingAssessmentConfig) return;
  syncQuestionsFromEditor(ctx);
  if (els.editIsTryout) ctx.pendingAssessmentConfig.isTryout = els.editIsTryout.checked;
  const assessment = createAssessment(ctx.pendingAssessmentConfig, ctx.pendingQuestions);
  const existingIndex = ctx.state.assessments.findIndex((a) => a.id === assessment.id);
  if (existingIndex >= 0) {
    await updateAssessment(assessment.id, assessment);
    ctx.state.assessments[existingIndex] = assessment;
  } else {
    await saveAssessmentToDatabase(assessment);
    ctx.state.assessments.unshift(assessment);
  }
  ctx.session.selectAssessment(assessment.id);
  ctx.pendingAssessmentConfig = null;
  ctx.pendingQuestions = [];
  els.form.reset();
  els.questionCount.value = DEFAULT_QUESTION_COUNT;
  goToWizardStep(ctx, 1);
  await renderCurrentState2(ctx);
}
async function improvePendingQuestionSet(ctx) {
  const { els } = ctx;
  if (!ctx.pendingAssessmentConfig) return;
  syncQuestionsFromEditor(ctx);
  const defaultText = "AI Rubric Alignment";
  setButtonLoading(els.improveQuestionSet, true, "Menyelaraskan rubrik & soal...", defaultText);
  showQuestionStreamPlaceholder(ctx);
  try {
    ctx.pendingQuestions = await alignRubricWithFallback(ctx, ctx.pendingAssessmentConfig, ctx.pendingQuestions);
    finishQuestionStream(ctx);
    await new Promise((resolve) => setTimeout(resolve, 500));
    hideStreamPanel(ctx, els.aiStreamPanel);
    renderQuestionEditor(ctx);
  } catch (error) {
    showToast(error.message);
  } finally {
    setButtonLoading(els.improveQuestionSet, false, "Menyelaraskan rubrik & soal...", defaultText);
  }
}
function syncQuestionsFromEditor(ctx) {
  const { els } = ctx;
  ctx.pendingQuestions = [...els.editableQuestionList.querySelectorAll(".editable-question")].map((item, index) => ({ id: ctx.pendingQuestions[index]?.id || `q-${index}`, prompt: item.querySelector("[data-field='prompt']").value.trim(), focus: item.querySelector("[data-field='focus']").value.trim(), outcome: item.querySelector("[data-field='outcome']").value.trim(), rubric: ctx.pendingQuestions[index]?.rubric || "", ideal: item.querySelector("[data-field='ideal']").value.trim(), criteria: ctx.pendingQuestions[index]?.criteria || [], probing: item.querySelector("[data-field='probing']")?.checked ?? !!ctx.pendingQuestions[index]?.probing }));
}
function renderQuestionEditor(ctx) {
  const { els } = ctx;
  if (!ctx.pendingAssessmentConfig) {
    els.questionEditor.classList.add("hidden");
    els.editableQuestionList.innerHTML = "";
    return;
  }
  els.questionEditor.classList.remove("hidden");
  if (els.editDisableManualTyping) els.editDisableManualTyping.checked = !!ctx.pendingAssessmentConfig.disableManualTyping;
  if (els.editOralExamEnabled) els.editOralExamEnabled.checked = ctx.pendingAssessmentConfig.oralExamEnabled !== false;
  if (els.editAllowRetakes) els.editAllowRetakes.checked = !!ctx.pendingAssessmentConfig.allowRetakes;
  if (els.editIsTryout) els.editIsTryout.checked = !!ctx.pendingAssessmentConfig.isTryout;
  els.editableQuestionList.innerHTML = ctx.pendingQuestions.map((question, index) => `<article class="feedback-card editable-question"><div class="question-card-header"><strong>Soal ${index + 1}</strong><button type="button" class="action-button danger-button delete-question" data-index="${index}" aria-label="Hapus soal ${index + 1}">Hapus</button></div><label>Pertanyaan<textarea data-field="prompt" rows="3">${escapeHtml(question.prompt)}</textarea></label><label>Fokus<input data-field="focus" value="${escapeHtml(question.focus || "")}" /></label>${Array.isArray(question.criteria) && question.criteria.length ? `<div class="q-criteria-chip">Rubrik yang diukur soal ini: ${question.criteria.map((c) => typeof c === "string" ? c : c.name || prettifyId(c.id)).map(escapeHtml).join(" \xB7 ")}</div>` : ""}<label>Learning outcome (kompetensi yang diukur)<textarea data-field="outcome" rows="2">${escapeHtml(question.outcome || "")}</textarea></label><label>Rubrik penilaian soal ini<div class="rubrik-preview" style="margin-top:6px;">${question.rubric ? renderRubricTable(question.rubric) : ""}</div><button type="button" class="secondary-button rubrik-builder-toggle" data-index="${index}" style="margin-top: 6px; font-size: 0.85rem;">\u270F\uFE0F Edit Rubrik</button></label><div class="rubrik-builder rubrik-builder-${index}" style="display: none;"></div><label>Jawaban ideal<textarea data-field="ideal" rows="3">${escapeHtml(question.ideal || "")}</textarea></label><label class="probing-toggle check-row"><input type="checkbox" data-field="probing" ${question.probing ? "checked" : ""} /><span>\u26A1 <strong>Aktifkan probing</strong> \u2014 siswa mendapat 1 pertanyaan lanjutan berbasis jawabannya setelah menjawab soal ini.</span></label></article>`).join("");
  renderReviewSummary(ctx);
}
var _wizardCtx;
var init_assessment_wizard = __esm({
  "src/js/assessment-wizard.js"() {
    init_config();
    init_api();
    init_assessment_factory();
    init_dom();
    init_fallback_assessment();
    init_toast();
    init_utils();
    init_app_context();
    init_question_bank();
    init_render();
    init_assessment_wizard_tail();
    _wizardCtx = null;
  }
});

// src/js/complaints.js
var complaints_exports = {};
__export(complaints_exports, {
  bindComplaintEvents: () => bindComplaintEvents,
  collectComplaints: () => collectComplaints,
  notifyStudentComplaintStatus: () => notifyStudentComplaintStatus,
  renderComplaints: () => renderComplaints,
  updateComplaintBadge: () => updateComplaintBadge
});
function bindComplaintEvents(ctx) {
  const { els } = ctx;
  if (els.complaintList) {
    els.complaintList.addEventListener("click", async (e) => {
      const respondBtn = e.target.closest(".complaint-respond-btn");
      const rejectBtn = e.target.closest(".complaint-reject-btn");
      if (!respondBtn && !rejectBtn) return;
      const submissionId = respondBtn?.dataset.submissionId || rejectBtn?.dataset.submissionId;
      const questionIndex = Number(respondBtn?.dataset.questionIndex ?? rejectBtn?.dataset.questionIndex);
      const submission = ctx.state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      const qs = submission.questionScores[questionIndex];
      if (!qs?.complaint) return;
      if (rejectBtn) {
        const newScore = Math.max(0, qs.score - 20);
        const response = prompt(
          `Tolak komplain untuk Soal ${questionIndex + 1}?

Skor akan dikurangi 20 poin: ${qs.score} \u2192 ${newScore}

Tuliskan penjelasan untuk siswa (opsional):`,
          ""
        );
        if (response === null) return;
        qs.score = newScore;
        qs.complaint = {
          ...qs.complaint,
          status: "rejected",
          response: String(response || "").trim(),
          resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      } else {
        const newScoreStr = prompt(
          `Re-evaluasi Soal ${questionIndex + 1} (skor saat ini: ${qs.score}):
Masukkan skor baru (0-100):`,
          qs.score
        );
        if (newScoreStr === null) return;
        const scoreVal = parseInt(newScoreStr, 10);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          showToast("Skor tidak valid. Harus angka 0-100", "error");
          return;
        }
        const response = prompt("Respon untuk siswa (penjelasan keputusan):", "");
        if (response === null) return;
        qs.score = scoreVal;
        qs.complaint = {
          ...qs.complaint,
          status: "resolved",
          response: String(response || "").trim(),
          resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      submission.finalScore = Math.round(
        submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length
      );
      try {
        await saveSubmissionToDatabase(submission);
        showToast("Komplain berhasil diproses", "success");
        renderComplaints(ctx);
        updateComplaintBadge(ctx);
        renderCurrentState2(ctx);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}
function collectComplaints(ctx) {
  const entries = [];
  for (const submission of ctx.state.submissions) {
    (submission.questionScores || []).forEach((qs, questionIndex) => {
      if (!qs.complaint) return;
      entries.push({
        submissionId: submission.id,
        studentName: submission.studentName,
        assessmentTitle: submission.assessmentTitle,
        questionIndex,
        question: qs.question,
        answer: qs.answer,
        score: qs.score,
        complaint: qs.complaint
      });
    });
  }
  return {
    pending: entries.filter((e) => e.complaint.status === "pending"),
    resolved: entries.filter((e) => e.complaint.status === "resolved"),
    rejected: entries.filter((e) => e.complaint.status === "rejected")
  };
}
function renderComplaints(ctx) {
  const { els } = ctx;
  if (!els.complaintList) return;
  const { pending, resolved, rejected } = collectComplaints(ctx);
  els.complaintCount.textContent = String(pending.length);
  if (!pending.length && !resolved.length && !rejected.length) {
    els.complaintList.className = "complaint-list empty-state";
    els.complaintList.innerHTML = "Belum ada komplain.";
    return;
  }
  els.complaintList.className = "complaint-list";
  els.complaintList.innerHTML = `
    ${renderComplaintGroup("Menunggu", pending, "complaint-pending")}
    ${renderComplaintGroup("Selesai", resolved, "complaint-resolved")}
    ${renderComplaintGroup("Ditolak", rejected, "complaint-rejected")}
  `;
}
function renderComplaintGroup(title, items, statusClass) {
  if (!items.length) return "";
  return `
    <div class="complaint-group">
      <h4>${escapeHtml(title)} (${items.length})</h4>
      ${items.map((entry) => renderComplaintItem(entry, statusClass)).join("")}
    </div>
  `;
}
function renderComplaintItem(entry, statusClass) {
  const { complaint } = entry;
  const isPending = complaint.status === "pending";
  const actionButtons = isPending ? `
      <div class="item-actions">
        <button type="button" class="action-button complaint-respond-btn" data-submission-id="${escapeHtml(entry.submissionId)}" data-question-index="${entry.questionIndex}">Respon</button>
        <button type="button" class="action-button danger-button complaint-reject-btn" data-submission-id="${escapeHtml(entry.submissionId)}" data-question-index="${entry.questionIndex}">Tolak (-20)</button>
      </div>
    ` : "";
  return `
    <article class="complaint-item ${statusClass}">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong>${escapeHtml(entry.studentName)}</strong>
          <span class="tag">${escapeHtml(entry.assessmentTitle)}</span>
          <span class="tag">Soal ${entry.questionIndex + 1} \xB7 Skor ${entry.score}</span>
        </div>
        <p style="margin-top: 6px;"><b>Soal:</b> ${escapeHtml(entry.question)}</p>
        <p><b>Jawaban:</b> <i>"${escapeHtml(entry.answer || "Tidak ada jawaban")}"</i></p>
        <div class="complaint-box ${statusClass}" style="margin: 8px 0 0;">
          <strong>\u{1F4E9} Komplain:</strong>
          <p>${escapeHtml(complaint.reason)}</p>
          ${complaint.response ? `<p class="complaint-response"><b>Respon:</b> ${escapeHtml(complaint.response)}</p>` : ""}
          <span class="tag">${escapeHtml(complaint.submittedAt ? new Date(complaint.submittedAt).toLocaleString("id-ID") : "")}</span>
        </div>
      </div>
      ${actionButtons}
    </article>
  `;
}
function updateComplaintBadge(ctx) {
  const { els } = ctx;
  if (!els.complaintNavBadge) return;
  const { pending } = collectComplaints(ctx);
  els.complaintNavBadge.textContent = String(pending.length);
  els.complaintNavBadge.classList.toggle("hidden", pending.length === 0);
}
function notifyStudentComplaintStatus(ctx) {
  const { els, auth } = ctx;
  if (!auth?.user || auth.user.role !== "student") return;
  if (els.complaintNotification) {
    els.complaintNotification.classList.add("hidden");
    els.complaintNotification.innerHTML = "";
  }
  if (!els.studentNotifList) return;
  const notifications = [];
  for (const submission of ctx.state.submissions) {
    (submission.questionScores || []).forEach((qs, questionIndex) => {
      if (!qs.complaint) return;
      const { status, response, reason, submittedAt } = qs.complaint;
      if (status === "resolved") {
        notifications.push({
          icon: "\u2705",
          statusClass: "complaint-resolved",
          title: `Komplain untuk "${submission.assessmentTitle}" (Soal ${questionIndex + 1}) diterima`,
          detail: `Skor baru: ${qs.score}.${response ? ` Guru: "${response}"` : ""}`,
          reason,
          submittedAt
        });
      } else if (status === "rejected") {
        notifications.push({
          icon: "\u274C",
          statusClass: "complaint-rejected",
          title: `Komplain untuk "${submission.assessmentTitle}" (Soal ${questionIndex + 1}) ditolak`,
          detail: `Skor dikurangi 20 poin menjadi ${qs.score}.${response ? ` Guru: "${response}"` : ""}`,
          reason,
          submittedAt
        });
      }
    });
  }
  if (!notifications.length) {
    els.studentNotifList.className = "complaint-list empty-state";
    els.studentNotifList.innerHTML = "Belum ada notifikasi komplain.";
    return;
  }
  els.studentNotifList.className = "complaint-list";
  els.studentNotifList.innerHTML = notifications.map(
    (n) => `
        <article class="notif-card ${n.statusClass}">
          <div class="notif-header">
            <span class="notif-icon" aria-hidden="true">${n.icon}</span>
            <div class="notif-title">
              <strong>${escapeHtml(n.title)}</strong>
              ${n.submittedAt ? `<span class="notif-date">${escapeHtml(new Date(n.submittedAt).toLocaleString("id-ID"))}</span>` : ""}
            </div>
          </div>
          <div class="notif-body">
            ${n.reason ? `<div class="notif-row"><span class="notif-label">Isi komplain</span><span>${escapeHtml(n.reason)}</span></div>` : ""}
            <div class="notif-row"><span class="notif-label">Keputusan</span><span>${escapeHtml(n.detail)}</span></div>
          </div>
        </article>
      `
  ).join("");
}
var init_complaints = __esm({
  "src/js/complaints.js"() {
    init_api();
    init_toast();
    init_utils();
    init_app_context();
  }
});

// src/js/dashboard.js
var dashboard_exports = {};
__export(dashboard_exports, {
  bindDashboardEvents: () => bindDashboardEvents,
  openAssessmentDetail: () => openAssessmentDetail,
  openStudentProfile: () => openStudentProfile,
  renderAssessmentsWithTab: () => renderAssessmentsWithTab,
  renderDashboard: () => renderDashboard,
  renderStudentProfile: () => renderStudentProfile
});
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function bindDashboardEvents(ctx) {
  const { els } = ctx;
  els.dashboardClassFilter?.addEventListener("change", () => renderDashboard(ctx));
  els.dashboardRangeFilter?.addEventListener("change", () => renderDashboard(ctx));
  els.profileStudentSelect?.addEventListener("change", (e) => {
    if (e.target.value) {
      ctx.profileSelectedStudent = e.target.value;
      renderStudentProfile(ctx, e.target.value, ctx.currentDetailReturnView);
    }
  });
  els.detailBackBtn?.addEventListener("click", () => {
    const target = ctx.currentDetailReturnView || "dashboardView";
    switchView(ctx, target);
  });
  els.assessmentTabFilter?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-filter-btn");
    if (!btn) return;
    els.assessmentTabFilter.querySelectorAll(".tab-filter-btn").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    renderAssessmentsWithTab(ctx);
  });
  els.assessmentListView?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav-view]");
    if (btn) switchView(ctx, btn.dataset.navView);
  });
  els.recentAssessmentsList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-open-detail]");
    if (!btn) return;
    await openAssessmentDetail(ctx, btn.dataset.openDetail);
  });
  els.atRiskList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-profile]");
    if (!btn) return;
    openStudentProfile(ctx, btn.dataset.openProfile);
  });
  els.assessmentDetailContent?.addEventListener("click", async (e) => {
    const traceBtn = e.target.closest("#loadTraceBtn");
    if (traceBtn) {
      await loadAssessmentTrace(ctx);
      return;
    }
    const profileBtn = e.target.closest("[data-open-profile]");
    if (profileBtn) {
      openStudentProfile(ctx, profileBtn.dataset.openProfile);
    }
  });
  els.studentProfileContent?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-open-detail]");
    if (!btn) return;
    await openAssessmentDetail(ctx, btn.dataset.openDetail, "studentProfileView");
  });
}
async function renderDashboard(ctx) {
  const { els, state } = ctx;
  const classId = els.dashboardClassFilter.value || "";
  const range = els.dashboardRangeFilter.value || "30";
  const rangeDays = range === "all" ? null : Number(range);
  populateClassFilter(ctx, els.dashboardClassFilter, classId);
  const klass = classId ? state.classes.find((c) => c.id === classId) : null;
  els.dashboardSubtitle.textContent = klass ? klass.name : "Semua Kelas";
  const scope = filterScope(ctx, classId, rangeDays);
  const assigned = assignedStudentCount(ctx, state.memberships, classId, scope);
  renderSkeleton(els.dashboardKpis, 4);
  renderSkeleton(els.performanceChart, 1, 220);
  renderSkeleton(els.scoreDistribution, 1, 180);
  renderSkeleton(els.competencyOverview, 1, 160);
  renderSkeleton(els.atRiskList, 1, 120);
  els.recentAssessmentsList.innerHTML = '<tr><td colspan="6" class="empty-state">Memuat\u2026</td></tr>';
  await new Promise((r) => setTimeout(r, 60));
  const evaluated = scope.filter(hasValidScore);
  const avg = evaluated.length ? Math.round(evaluated.reduce((a, s) => a + s.finalScore, 0) / evaluated.length) : null;
  const nameMap = assessmentsRubricNameMap(state.assessments);
  const profiles = buildStudentProfiles(scope, nameMap);
  const atRisk = profiles.filter((p) => p.atRisk);
  const completionRate = assigned ? Math.min(100, Math.round(evaluated.length / Math.max(assigned, evaluated.length) * 100)) : 0;
  els.dashboardKpis.innerHTML = [
    kpiCard(
      "Pengumpulan",
      scope.length,
      "submission",
      "Total submission dalam rentang terpilih"
    ),
    kpiCard(
      "Rata-rata Skor",
      avg === null ? "\u2014" : String(avg),
      "Evaluated",
      "Hanya penilaian tervalidasi (EVALUATED) yang dihitung"
    ),
    kpiCard(
      "Tingkat Penyelesaian",
      `${completionRate}%`,
      "completed / assigned",
      "Submission tervalidasi dibagi siswa yang ditugaskan"
    ),
    kpiCard(
      "Perlu Perhatian",
      String(atRisk.length),
      "siswa",
      "Skor rendah, tren menurun, atau kelemahan kompetensi berulang"
    )
  ].join("");
  els.atRiskCount.textContent = `${atRisk.length} siswa`;
  renderTrendChart(els.performanceChart, evaluated);
  renderDistribution(els.scoreDistribution, evaluated);
  renderCompetencies(els.competencyOverview, state.assessments, evaluated);
  renderAtRisk(els.atRiskList, atRisk);
  renderCompTrend(ctx, evaluated, assessmentsRubricNameMap(state.assessments));
  renderRecentAssessments(els.recentAssessmentsList, recentSubmissions(scope, 8));
}
function openStudentProfile(ctx, studentName) {
  if (!studentName) return;
  ctx.profileSelectedStudent = studentName;
  ctx.currentDetailReturnView = "dashboardView";
  renderStudentProfile(ctx, studentName);
  switchView(ctx, "studentProfileView");
}
async function renderStudentProfile(ctx, studentName, returnView = "dashboardView") {
  const { els, state } = ctx;
  const allSubs = state.submissions.filter((s) => s.studentName === studentName);
  const evaluated = allSubs.filter(hasValidScore).slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const avg = evaluated.length ? Math.round(evaluated.reduce((a, s) => a + s.finalScore, 0) / evaluated.length) : null;
  const last = evaluated.at(-1);
  const first = evaluated[0];
  const improvement = evaluated.length > 1 && last && first ? last.finalScore - first.finalScore : null;
  els.studentProfileContent.innerHTML = `
    <div class="kpi-grid">
      ${kpiCard("Rata-rata Skor", avg === null ? "\u2014" : String(avg), "evaluasi tervalidasi")}
      ${kpiCard("Penilaian", String(evaluated.length), "dari " + allSubs.length + " pengumpulan")}
      ${kpiCard("Perbaikan", improvement === null ? "\u2014" : `${improvement >= 0 ? "+" : ""}${improvement}`, "skor awal \u2192 terakhir")}
      ${kpiCard("Penilaian Terakhir", last ? String(last.finalScore) : "\u2014", last ? compactText(last.assessmentTitle, 28) : "belum ada")}
    </div>
    <div class="analytics-panel wide">
      <h3>Tren Performa</h3>
      ${evaluated.length ? buildProfileTrend(evaluated) : `<p class="empty-state">Belum ada evaluasi tervalidasi.</p>`}
    </div>
    <div class="analytics-panel wide">
      <h3>Profil Kompetensi</h3>
      ${renderCompetencyStudent(buildCompetencyProfile(ctx.state.assessments, evaluated))}
    </div>
    <div class="analytics-panel wide">
      <h3>Riwayat Penilaian</h3>
      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Penilaian</th><th>Tanggal</th><th>Skor</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${allSubs.slice().reverse().map((s) => `
              <tr class="submission-row" data-id="${s.id}">
                <td data-label="Penilaian"><strong>${escapeHtml(s.assessmentTitle)}</strong></td>
                <td data-label="Tanggal">${formatDate(s.submittedAt)}</td>
                <td data-label="Skor">${hasValidScore(s) ? s.finalScore : "\u2014"}</td>
                <td data-label="Status">${renderStatusBadge(getSubmissionStatus(s))}</td>
                <td data-label="Aksi">
                  <button type="button" class="secondary-button view-submission-btn" data-open-detail="${escapeHtml(s.id)}">View</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="5" class="empty-state">Belum ada penilaian untuk siswa ini.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
async function openAssessmentDetail(ctx, submissionId, fromView = "dashboardView") {
  const summary = ctx.state?.submissions?.find((s) => s.id === submissionId);
  if (!summary) {
    showToast("Penilaian tidak ditemukan.", "error");
    return;
  }
  let submission = summary;
  try {
    submission = await getSubmissionDetail(submissionId);
  } catch {
  }
  const { els } = ctx;
  ctx.currentDetailSubmissionId = submission.id;
  ctx.currentDetailReturnView = fromView;
  els.assessmentDetailContent.innerHTML = renderSkeletonLines(4);
  switchView(ctx, "assessmentDetailView");
  renderAssessmentDetail(ctx, submission);
}
function renderAssessmentDetail(ctx, submission) {
  const { els, state } = ctx;
  const status = getSubmissionStatus(submission);
  const evaluated = hasValidScore(submission);
  const verification = submission.verification || null;
  const criteria = Array.isArray(submission.criteria) ? submission.criteria : [];
  const confidence = criteriaAvgConfidence(criteria);
  const confidencePct = confidence === null ? null : `${Math.round(confidence * 100)}%`;
  const coverage = verification?.scoreConsistency?.coverage ?? criteriaCoverage(criteria);
  const coveragePct = coverage === null ? null : `${Math.round(coverage * 100)}%`;
  const scoredCriteria = criteria.filter((c) => Number.isFinite(Number(c.score))).length;
  const rubricPct = criteria.length ? Math.round(scoredCriteria / criteria.length * 100) : null;
  const verStatus = verification?.status || (verification?.valid === false ? "FAIL" : verification ? "PASS" : null);
  const assessment = state.assessments.find((a) => a.id === submission.assessmentId);
  const rubricHtml = assessment && Array.isArray(assessment.questions) ? assessment.questions.map((q, i) => {
    const rubricText = q.rubric || "";
    if (!rubricText) return "";
    return `
          <div class="analytics-panel" style="margin-top:16px;">
            <h4>Soal ${i + 1}: ${escapeHtml(q.prompt || "")}</h4>
            ${renderRubricTable(rubricText)}
          </div>`;
  }).filter(Boolean).join("") : "";
  const detailMeta = `
    <div class="detail-hero">
      <div class="detail-hero-main">
        <p class="eyebrow">Assessment Detail</p>
        <h3>${escapeHtml(submission.assessmentTitle)}</h3>
        <div class="detail-meta">
          <span><strong>Siswa:</strong>
            <button type="button" class="link-button" data-open-profile="${escapeHtml(submission.studentName)}">${escapeHtml(submission.studentName)}</button>
          </span>
          <span><strong>Tanggal:</strong> ${formatDateTime2(submission.submittedAt)}</span>
          <span><strong>Status:</strong> ${renderStatusBadge(status)}</span>
          <span><strong>Sumber:</strong> ${submission.evaluationSource === "fallback" ? "Evaluasi lokal (deterministik)" : "AI Harness"}</span>
        </div>
      </div>
      <div class="detail-score-block">
        ${evaluated ? `<div class="score-badge">${submission.finalScore}<span class="score-max">/100</span></div>` : `<div class="score-badge score-muted">\u2014</div>`}
        <div class="detail-trust-row">
          ${confidencePct ? `<span class="trust-chip">Confidence ${confidencePct}</span>` : ""}
          ${coveragePct ? `<span class="trust-chip">Bukti grounded ${coveragePct}</span>` : ""}
          ${rubricPct !== null ? `<span class="trust-chip">Cakupan rubrik ${rubricPct}%</span>` : ""}
        </div>
        ${verification ? `<div class="verification-mini">${verificationBadge(verStatus)}</div>` : ""}
      </div>
    </div>
  `;
  const criteriaHtml = criteria.length ? `<div class="analytics-panel">
        <div class="panel-head-row">
          <h3 style="margin:0;">Criterion</h3>
          <span class="metric-pill">${criteria.length} kriteria</span>
        </div>
        <p class="panel-hint">Skor per kriteria rubrik, dengan bukti yang dapat ditelusuri ke jawaban siswa.</p>
        <div class="criterion-stack">${criteria.map((c, i) => renderCriterion(c, i, rubricNameMap(assessment))).join("")}</div>
      </div>` : `<div class="analytics-panel"><h3>Criterion</h3><div class="empty-state">Belum ada data kriteria \u2014 gunakan evaluasi berbasis rubrik (AI Harness).</div></div>`;
  const traceHtml = `
    <div class="analytics-panel">
      <div class="panel-head-row">
        <h3 style="margin:0;">Jejak Penilaian (Trace)</h3>
        ${submission.evaluationRunId ? `<button class="secondary-button" id="loadTraceBtn" type="button" style="min-height:36px;font-size:0.9rem;">Lihat Trace</button>` : `<span class="metric-pill">lokal</span>`}
      </div>
      <p class="panel-hint">Alur teknis evaluasi: model \u2192 rubrik \u2192 evidence \u2192 verifikasi \u2192 skor deterministik.</p>
      <div id="traceContent"></div>
    </div>
  `;
  els.assessmentDetailContent.innerHTML = `
    ${detailMeta}
    ${criteriaHtml}
    ${rubricHtml}
    ${traceHtml}
  `;
}
function renderCriterion(c, index, nameMap = /* @__PURE__ */ new Map()) {
  const score = Number(c.score);
  const name = resolveCriterionName(c, index, nameMap);
  const evidence = Array.isArray(c.evidence) ? c.evidence : [];
  const grounded = evidence.some((ev) => ev && ev.grounded === true);
  const hasUngrounded = evidence.some((ev) => ev && ev.grounded === false);
  const evidenceHtml = evidence.length ? `<div class="criterion-evidence">
        <span class="evidence-status ${grounded ? "evidence-grounded" : "evidence-review"}">
          ${grounded ? "\u2713 Grounded" : hasUngrounded ? `\u26A0 ${evidence.filter((ev) => ev && ev.grounded === false).length} perlu tinjauan` : "\u2713 Grounded"}
        </span>
        <ul>
          ${evidence.map((ev) => `
            <li>
              <span class="evidence-quote">\u201C${escapeHtmlSup(escapeHtml(compactText(String(ev.text || ""), 140)))}\u201D</span>
              ${ev.grounded !== void 0 && ev.grounded === false ? `<span class="evidence-tag tag-warn">tidak grounded</span>` : ""}
            </li>`).join("")}
        </ul>
      </div>` : `<p class="panel-hint">Tanpa evidence pada evaluasi ini.</p>`;
  const answerIndexText = c.answerIndex !== void 0 && Number.isInteger(Number(c.answerIndex)) ? `<span class="tag">Soal ${Number(c.answerIndex) + 1}</span>` : "";
  const weightText = c.weight ? `<span class="tag">bobot ${Math.round(Number(c.weight) * 100)}%</span>` : "";
  return `
    <article class="criterion-card">
      <div class="criterion-head">
        <div class="criterion-title">
          <strong>${escapeHtml(name)}</strong>
          <span>${answerIndexText}${weightText}</span>
        </div>
        <span class="criterion-score${Number.isFinite(score) && score < 70 ? " low" : ""}">
          ${Number.isFinite(score) ? score : "\u2014"}<span class="font-max">/100</span>
        </span>
      </div>
      ${Number.isFinite(score) ? `<div class="meter"><span class="meter-fill" style="width:${Math.max(2, Math.min(100, score))}%"></span></div>` : ""}
      ${evidenceHtml}
      ${c.rationale ? `<p class="criterion-rationale"><span class="panel-hint">Alasan: </span>${formatRichText2(c.rationale)}</p>` : ""}
    </article>
  `;
}
function rubricNameMap(assessment) {
  const map = /* @__PURE__ */ new Map();
  if (!assessment) return map;
  const push = (defs) => {
    (Array.isArray(defs) ? defs : []).forEach((c) => {
      if (!c || !c.name) return;
      if (c.id) map.set(`id:${normalizeKey(c.id)}`, c.name);
      map.set(`name:${normalizeKey(c.name)}`, c.name);
    });
  };
  if (assessment.rubric) push(parseRubricToCriteria(assessment.rubric));
  (Array.isArray(assessment.questions) ? assessment.questions : []).forEach((q) => {
    if (q && q.rubric) push(parseRubricToCriteria(q.rubric));
  });
  return map;
}
function assessmentsRubricNameMap(assessments) {
  const map = /* @__PURE__ */ new Map();
  (Array.isArray(assessments) ? assessments : []).forEach((a) => {
    rubricNameMap(a).forEach((value, key) => {
      if (!map.has(key)) map.set(key, value);
    });
  });
  return map;
}
function normalizeKey(value) {
  return String(value == null ? "" : value).toLowerCase().trim();
}
function resolveCriterionName(c, index, nameMap) {
  const id = nameMap.get(`id:${normalizeKey(c.criterionId)}`);
  if (id) return id;
  const byName = c.name ? nameMap.get(`name:${normalizeKey(c.name)}`) : void 0;
  if (byName) return byName;
  if (c.name && looksLikeRubricDump(c.name)) {
    return prettifyId(c.criterionId) || `Kriteria ${index + 1}`;
  }
  return c.name || prettifyId(c.criterionId) || `Kriteria ${index + 1}`;
}
function looksLikeRubricDump(value) {
  const s = String(value || "");
  if (s.length < 80) return false;
  return /\b(config|criteria\s+id|levels|descriptor)\b/i.test(s) && /\b(weight|score)\b/i.test(s);
}
async function loadAssessmentTrace(ctx) {
  const { els } = ctx;
  const submission = ctx.state?.submissions?.find((s) => s.id === ctx.currentDetailSubmissionId);
  const runId = submission?.evaluationRunId;
  const content = els.assessmentDetailContent?.querySelector("#traceContent");
  if (!runId || !content || content.dataset.loaded) return;
  content.innerHTML = `<p class="empty-state">Memuat jejak penilaian\u2026</p>`;
  try {
    const res = await fetch(`/api/research?action=trace&runId=${encodeURIComponent(runId)}`, {
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat trace");
    content.innerHTML = renderTrace(data);
    content.dataset.loaded = "1";
  } catch (err) {
    content.innerHTML = `<p class="empty-state">Trace tidak tersedia: ${escapeHtml(err.message)}</p>`;
  }
}
function renderTrace(data) {
  const run = data.run;
  const versions = data.versions || {};
  const events = Array.isArray(data.events) ? data.events : [];
  const result = data.result || {};
  const metadata = [
    ["Model", result.versioning?.modelVersion || run?.model || versions.model_version || "-"],
    ["Provider", run?.model || "-"],
    ["Model Version", versions.model_version || result.versioning?.modelVersion || "-"],
    ["Rubric Version", versions.rubric_version || result.versioning?.rubricVersion || "-"],
    ["Harness Version", versions.harness_version || result.versioning?.harnessVersion || "-"],
    ["Prompt Version", versions.prompt_version || result.versioning?.promptVersion || "-"],
    ["Waktu Evaluasi", run?.created_at ? formatDateTime2(run.created_at) : "-"]
  ];
  const hashes = [
    run?.prompt_hash && ["Prompt Hash", run.prompt_hash],
    run?.rubric_hash && ["Rubric Hash", run.rubric_hash],
    run?.input_hash && ["Input Hash", run.input_hash],
    run?.config_hash && ["Config Hash", run.config_hash]
  ].filter(Boolean);
  const steps = traceSteps(events);
  return `
    <div class="trace-steps">
      ${steps.length ? steps.map((s) => `<div class="trace-step"><span class="trace-step-arrow" aria-hidden="true">\u2193</span><span>${escapeHtml(s)}</span></div>`).join("") : `<p class="panel-hint">Belum ada event lengkap untuk run ini.</p>`}
    </div>
    <details class="trace-details">
      <summary>Metadata teknis &amp; versi</summary>
      <dl class="trace-meta">
        ${metadata.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}
      </dl>
      ${hashes.length ? `<h4>Hash Reproduksibilitas</h4><dl class="trace-meta">${hashes.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(v)}</code></dd></div>`).join("")}</dl>` : ""}
    </details>
  `;
}
function traceSteps(events) {
  if (!events.length) return [];
  const map = new Map(events.map((ev) => [ev.type, true]));
  const steps = [];
  for (const type of ["ASSESSMENT_LOADED", "RUBRIC_LOADED", "CONTEXT_BUILT", "EVIDENCE_EXTRACTED", "VERIFICATION", "VERIFICATION_RUN", "FINAL_SCORE"]) {
    if (map.has(type) && labels1[type] && !steps.includes(labels1[type])) steps.push(labels1[type]);
  }
  if (!steps.length) return events.map((ev) => ev.type);
  return steps;
}
function renderTrendChart(el, submissions) {
  if (!submissions.length) {
    el.innerHTML = `<p class="empty-state">Belum ada penilaian tervalidasi di rentang ini.</p>`;
    return;
  }
  const sorted = submissions.slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const first = new Date(sorted[0].submittedAt);
  const lastDate = new Date(sorted[sorted.length - 1].submittedAt);
  const bucketCount = Math.max(2, Math.min(12, Math.ceil((lastDate - first) / WEEK_MS) + 1));
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start = new Date(first.getTime() + i * WEEK_MS);
    const end = new Date(start.getTime() + WEEK_MS);
    const items = sorted.filter((s) => {
      const t = new Date(s.submittedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    return {
      label: start.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      avg: items.length ? Math.round(items.reduce((a, s) => a + s.finalScore, 0) / items.length) : null,
      count: items.length
    };
  });
  const W = 640;
  const H = 200;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = buckets.length;
  const slot = innerW / n;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const band = (i) => padL + slot * i + slot / 2;
  const yFor = (v) => padT + innerH - v / 100 * innerH;
  const barW = Math.min(26, slot * 0.4);
  const bars = buckets.map((b, i) => {
    const h = Math.max(2, b.count / maxCount * innerH);
    return `<rect x="${(band(i) - barW / 2).toFixed(1)}" y="${(padT + innerH - h).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="3" fill="${cssVar("--brand-soft")}" />`;
  }).join("");
  const linePoints = buckets.map((b, i) => b.avg === null ? null : `${band(i).toFixed(1)},${yFor(b.avg).toFixed(1)}`).filter(Boolean);
  const line = linePoints.length > 1 ? `<polyline points="${linePoints.join(" ")}" fill="none" stroke="${cssVar("--brand")}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : "";
  const circles = buckets.map((b, i) => b.avg === null ? "" : `<circle cx="${band(i).toFixed(1)}" cy="${yFor(b.avg).toFixed(1)}" r="3.5" fill="${cssVar("--brand")}"/>`).join("");
  const gridLines = [0, 25, 50, 75, 100].map((v) => `<line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="${cssVar("--border")}" stroke-width="1"/>`).join("");
  const gridLabels = [0, 25, 50, 75, 100].map((v) => `<text x="${padL - 6}" y="${yFor(v) + 4}" text-anchor="end" fill="${cssVar("--text-muted")}" font-size="10">${v}</text>`).join("");
  const xLabels = buckets.map((b, i) => `<text x="${band(i)}" y="${H - 8}" text-anchor="middle" fill="${cssVar("--text-muted")}" font-size="9">${escapeXml(b.label)}</text>`).join("");
  el.innerHTML = `
    <div class="chart-legend" aria-hidden="true">
      <span class="legend-item"><span class="legend-line"></span>Rata-rata skor</span>
      <span class="legend-item"><span class="legend-bar"></span>Jumlah submission</span>
    </div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren rata-rata skor per minggu">
      ${gridLines}
      ${gridLabels}
      ${bars}
      ${line}
      ${circles}
      ${xLabels}
    </svg>
  `;
}
function renderDistribution(el, submissions) {
  if (!submissions.length) {
    el.innerHTML = `<p class="empty-state">Belum ada penilaian tervalidasi untuk ditampilkan.</p>`;
    return;
  }
  const buckets = [
    { label: "0\u201320", min: 0, max: 20 },
    { label: "21\u201340", min: 21, max: 40 },
    { label: "41\u201360", min: 41, max: 60 },
    { label: "61\u201380", min: 61, max: 80 },
    { label: "81\u2013100", min: 81, max: 100 }
  ];
  const total = submissions.length;
  el.innerHTML = `
    <div class="dist-bars">
      ${buckets.map((b) => {
    const count = submissions.filter((s) => s.finalScore >= b.min && s.finalScore <= b.max).length;
    const pct = Math.round(count / total * 100);
    return `
          <div class="dist-row">
            <span class="dist-label">${b.label}</span>
            <div class="dist-track"><span class="dist-fill" style="width:${pct}%"></span></div>
            <span class="dist-count">${count}</span>
          </div>`;
  }).join("")}
    </div>
  `;
}
function renderCompetencies(el, assessments, submissions) {
  const comps = buildCompetencyProfile(assessments, submissions);
  el.innerHTML = renderCompetencyClass(comps);
}
function renderAtRisk(el, atRisk) {
  if (!atRisk.length) {
    el.innerHTML = `
      <div class="empty-state ok-state">
        <span class="empty-state-icon" aria-hidden="true">\u2713</span>
        <div><strong>Tidak ada siswa yang perlu perhatian</strong><p>Semua siswa berada di atas ambang intervensi (${ATTENTION_SCORE_THRESHOLD}).</p></div>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-container" style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Siswa</th><th>Skor</th><th>Tren</th><th>Isu Utama</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          ${atRisk.slice(0, 8).map((p) => `
            <tr class="submission-row" data-id="${p.studentName}">
              <td data-label="Siswa"><strong>${escapeHtml(p.studentName)}</strong></td>
              <td data-label="Skor">${p.latest !== null ? p.latest : "\u2014"}</td>
              <td data-label="Tren" class="${trendClass(p.trend)}">${trendArrow(p.trend)}</td>
              <td data-label="Isu Utama">${escapeHtml(p.mainIssue)}</td>
              <td data-label="Status"><span class="status-badge status-review">At Risk</span></td>
              <td data-label="Aksi">
                <button type="button" class="secondary-button view-submission-btn" data-open-profile="${escapeHtml(p.studentName)}">View</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderRecentAssessments(el, subs) {
  if (!subs.length) {
    el.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada penilaian yang dikumpulkan siswa.</td></tr>`;
    return;
  }
  el.innerHTML = subs.map((s) => {
    const status = getSubmissionStatus(s);
    const actionLabel = status === "NEEDS_REVIEW" ? "Review" : status === "EVALUATING" ? "Lihat Progres" : status === "FAILED" ? "Retry / Review" : "View";
    return `
      <tr class="submission-row" data-id="${s.id}">
        <td data-label="Siswa"><strong>${escapeHtml(s.studentName)}</strong></td>
        <td data-label="Penilaian">${escapeHtml(s.assessmentTitle)}</td>
        <td data-label="Tanggal">${formatDate(s.submittedAt)}</td>
        <td data-label="Skor">${hasValidScore(s) ? s.finalScore : "\u2014"}</td>
        <td data-label="Status">${renderStatusBadge(status)}</td>
        <td data-label="Aksi">
          <button type="button" class="secondary-button view-submission-btn" data-open-detail="${escapeHtml(s.id)}">${actionLabel}</button>
        </td>
      </tr>`;
  }).join("");
}
function filterScope(ctx, classId, rangeDays) {
  let list = ctx.state.submissions;
  if (classId) list = list.filter((s) => s.classId === classId);
  if (rangeDays) {
    const cutoff = Date.now() - rangeDays * 864e5;
    list = list.filter((s) => new Date(s.submittedAt).getTime() >= cutoff);
  }
  return list;
}
function assignedStudentCount(ctx, memberships, classId, scope) {
  const names = /* @__PURE__ */ new Set();
  memberships.forEach((m) => {
    if (m.status === "approved") {
      if (!classId || m.class_id === classId || m.classId === classId) {
        names.add(m.student_name || m.student_id);
      }
    }
  });
  scope.forEach((s) => names.add(s.studentName));
  return names.size;
}
function recentSubmissions(submissions, limit) {
  return submissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, limit);
}
function buildStudentProfiles(submissions, nameMap) {
  const byStudent = /* @__PURE__ */ new Map();
  submissions.forEach((s) => {
    if (!byStudent.has(s.studentName)) byStudent.set(s.studentName, []);
    byStudent.get(s.studentName).push(s);
  });
  const profiles = [];
  for (const [name, subs] of byStudent) {
    const evaluated = subs.filter(hasValidScore).slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    if (!evaluated.length) continue;
    const scores = evaluated.map((s) => s.finalScore);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const latest = scores.at(-1);
    const prev = evaluated.length > 1 ? scores.at(-2) : latest;
    const trend = latest - prev;
    const comps = aggregateCompetencies(evaluated, nameMap);
    const weak = weakestCompetency(comps);
    const repeatedWeak = weak && weak.count >= 2 && weak.avg < ATTENTION_SCORE_THRESHOLD;
    const atRisk = avg < ATTENTION_SCORE_THRESHOLD || trend <= ATTENTION_TREND_THRESHOLD || repeatedWeak;
    profiles.push({
      studentName: name,
      latest,
      avg,
      trend: trend > 0 ? 1 : trend < 0 ? -1 : 0,
      mainIssue: repeatedWeak && weak ? `${weak.name} (berulang)` : weak ? weak.name : "\u2014",
      atRisk
    });
  }
  return profiles.sort((a, b) => b.atRisk - a.atRisk || a.avg - b.avg);
}
function aggregateCompetencies(submissions, nameMap) {
  const map = /* @__PURE__ */ new Map();
  submissions.forEach((sub) => {
    (sub.criteria || []).forEach((c, idx) => {
      if (!Number.isFinite(Number(c.score))) return;
      const name = resolveCriterionName(c, idx, nameMap);
      const entry = map.get(name) || { name, total: 0, count: 0 };
      entry.total += Number(c.score);
      entry.count += 1;
      map.set(name, entry);
    });
  });
  return [...map.values()].map((e) => ({ name: e.name, avg: e.total / e.count, count: e.count })).sort((a, b) => b.avg - a.avg);
}
function weakestCompetency(comps) {
  return comps.length ? comps[comps.length - 1] : null;
}
function criteriaAvgConfidence(criteria) {
  const confs = (criteria || []).map((c) => Number(c.confidence)).filter((v) => Number.isFinite(v) && v > 0);
  if (!confs.length) return null;
  return confs.reduce((a, b) => a + b, 0) / confs.length;
}
function criteriaCoverage(criteria) {
  if (!criteria || !criteria.length) return null;
  const withEvidence = criteria.filter(
    (c) => Array.isArray(c.evidence) && c.evidence.some((ev) => ev && ev.grounded === true)
  ).length;
  return Math.round(withEvidence / criteria.length * 100);
}
function renderAssessmentsWithTab(ctx) {
  const { els, state } = ctx;
  const activeTab = els.assessmentTabFilter.querySelector(".tab-filter-btn.active")?.dataset.tab || "all";
  let list = state.assessments;
  if (activeTab === "draft") list = list.filter((a) => a.status === "draft");
  if (activeTab === "published") list = list.filter((a) => a.status !== "draft");
  els.assessmentCount.textContent = String(list.length);
  if (!list.length) {
    els.assessmentList.className = "list-stack empty-state";
    els.assessmentList.innerHTML = `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">\u25CB</span>
      <div><strong>${activeTab === "draft" ? "Belum ada draft" : "Belum ada penilaian"}</strong>
      <p>${activeTab === "draft" ? "Penilaian yang belum dipublish akan muncul di sini." : "Buat penilaian pertama untuk mulai."}</p></div></div>`;
    return;
  }
  els.assessmentList.className = "list-stack";
  els.assessmentList.innerHTML = list.map(renderAssessmentItem).join("");
}
function kpiCard(label, value, sub, hint) {
  return `
    <div class="kpi-card">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <strong class="kpi-value">${escapeHtml(value)}</strong>
      <span class="kpi-sub">${escapeHtml(sub)}</span>
      ${hint ? `<span class="kpi-hint" title="${escapeHtml(hint)}">\u24D8</span>` : ""}
    </div>
  `;
}
function renderSkeleton(el, count, height = 120) {
  if (!el) return;
  el.innerHTML = Array.from(
    { length: count },
    () => `<div class="skeleton" style="height:${height}px"></div>`
  ).join("");
}
function renderSkeletonLines(count) {
  return Array.from({ length: count }, () => `<div class="skeleton skeleton-line"></div>`).join("");
}
function populateClassFilter(ctx, select, currentValue) {
  if (!select) return;
  const current = currentValue || select.value;
  const options = ['<option value="">Semua Kelas</option>'].concat(ctx.state.classes.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)).join("");
  if (select.innerHTML !== options || select.value !== current) {
    select.innerHTML = options;
    if (current && ctx.state.classes.some((c) => c.id === current)) select.value = current;
  }
}
function verificationBadge(status) {
  const cls = status === "FAIL" ? "verification-mini-badge-bad" : status === "REVIEW" ? "verification-mini-badge-warn" : "verification-mini-badge-ok";
  const label = status === "FAIL" ? "\u2715 Failed" : status === "REVIEW" ? "\u26A0 Perlu Review" : "\u2713 Verified";
  return `<span class="verification-mini ${cls}">${label}</span>`;
}
function buildProfileTrend(evaluated) {
  const W = 640;
  const H = 160;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = Math.max(2, evaluated.length);
  const slot = innerW / (n - 1);
  const yFor = (v) => padT + innerH - v / 100 * innerH;
  const pointsStr = evaluated.map((s, i) => `${(padL + slot * i).toFixed(1)},${yFor(s.finalScore).toFixed(1)}`).join(" ");
  const gridLines = [0, 25, 50, 75, 100].map((v) => `<line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="${cssVar("--border")}" stroke-width="1"/>`).join("");
  const gridLabels = [0, 25, 50, 75, 100].map((v) => `<text x="${padL - 6}" y="${yFor(v) + 4}" text-anchor="end" fill="${cssVar("--text-muted")}" font-size="10">${v}</text>`).join("");
  const circles = evaluated.map((s, i) => `<circle cx="${(padL + slot * i).toFixed(1)}" cy="${yFor(s.finalScore).toFixed(1)}" r="4" fill="${cssVar("--brand")}"/>`).join("");
  const xLabels = evaluated.map((s, i) => `<text x="${(padL + slot * i).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="${cssVar("--text-muted")}" font-size="9">${escapeXml(formatDate(s.submittedAt))}</text>`).join("");
  return `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik skor siswa dari waktu ke waktu">
      ${gridLines}
      ${gridLabels}
      <polyline points="${pointsStr}" fill="none" stroke="${cssVar("--success-strong")}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}
      ${xLabels}
    </svg>
  `;
}
function trendArrow(trend) {
  return trend > 0 ? "\u2191" : trend < 0 ? "\u2193" : "\u2192";
}
function trendClass(trend) {
  return trend > 0 ? "trend-up" : trend < 0 ? "trend-down" : "trend-flat";
}
function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateTime2(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function formatRichText2(text) {
  if (!text) return "";
  const escaped = escapeHtml(String(text));
  return escaped.split(/\r?\n/).map((l) => {
    if (l.trim().startsWith("- ")) return `<li>${escapeHtmlSup(l.trim().slice(2))}</li>`;
    if (l.trim().startsWith("* ")) return `<li>${escapeHtmlSup(l.trim().slice(2))}</li>`;
    return l ? `<p>${escapeHtmlSup(l)}</p>` : "";
  }).join("");
}
function escapeHtmlSup(text) {
  let t = String(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}
function escapeXml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function renderCompTrend(ctx, evaluated, nameMap) {
  const { els } = ctx;
  if (!els.compTrendChart) return;
  const sorted = evaluated.slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  if (sorted.length < 2) {
    els.compTrendChart.innerHTML = '<p class="empty-state">Butuh minimal 2 submission untuk melihat tren kompetensi.</p>';
    return;
  }
  const compMap = /* @__PURE__ */ new Map();
  for (const sub of sorted) {
    const date = new Date(sub.submittedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" });
    (sub.criteria || []).forEach((c, idx) => {
      if (!Number.isFinite(Number(c.score))) return;
      const name = resolveCriterionName(c, idx, nameMap);
      if (!compMap.has(name)) compMap.set(name, []);
      compMap.get(name).push({ date, score: Number(c.score) });
    });
  }
  if (compMap.size === 0) {
    els.compTrendChart.innerHTML = '<p class="empty-state">Belum ada data kriteria. Evaluasi perlu memakai rubrik.</p>';
    return;
  }
  const COLORS = ["--brand", "--success", "--info", "--danger", "--warning", "--ai", "--voice", "--success-strong"].map((t) => cssVar(t));
  const entries = [...compMap.entries()];
  const W = 600, H = 180, PAD = 30;
  const allDates = [...new Set(sorted.map((s) => new Date(s.submittedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" })))];
  els.compTrendLegend.innerHTML = entries.map(
    ([name], i) => `<span><span class="swatch" style="background:${COLORS[i % COLORS.length]}"></span>${escapeHtml(name)}</span>`
  ).join("");
  let paths = "";
  entries.forEach(([name, points], i) => {
    const color = COLORS[i % COLORS.length];
    const xScale = (idx) => PAD + idx / Math.max(1, allDates.length - 1) * (W - 2 * PAD);
    const yScale = (score) => H - PAD - score / 100 * (H - 2 * PAD);
    const byDate = /* @__PURE__ */ new Map();
    points.forEach((p) => {
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      byDate.get(p.date).push(p.score);
    });
    const avgPoints = [...byDate.entries()].map(([date, scores]) => ({
      date,
      score: scores.reduce((a, b) => a + b, 0) / scores.length
    }));
    const line = avgPoints.map((p, idx) => {
      const x = xScale(allDates.indexOf(p.date));
      const y = yScale(p.score);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    paths += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    paths += avgPoints.map((p, idx) => {
      const x = xScale(allDates.indexOf(p.date));
      const y = yScale(p.score);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    }).join("");
  });
  const xLabels = allDates.map((d, idx) => {
    const x = PAD + idx / Math.max(1, allDates.length - 1) * (W - 2 * PAD);
    return `<text x="${x.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="${cssVar("--text-muted")}">${d}</text>`;
  }).join("");
  const yLabels = [0, 25, 50, 75, 100].map((v) => {
    const y = H - PAD - v / 100 * (H - 2 * PAD);
    return `<text x="${PAD - 5}" y="${y.toFixed(1) + 4}" text-anchor="end" font-size="9" fill="${cssVar("--text-muted")}">${v}</text>`;
  }).join("");
  els.compTrendChart.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;" role="img" aria-label="Grafik tren kompetensi">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="${cssVar("--border")}" stroke-width="1"/>
      <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H - PAD}" stroke="${cssVar("--border")}" stroke-width="1"/>
      ${[25, 50, 75].map((v) => {
    const y = H - PAD - v / 100 * (H - 2 * PAD);
    return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${cssVar("--border")}" stroke-width="1"/>`;
  }).join("")}
      ${paths}
      ${xLabels}
      ${yLabels}
    </svg>
  `;
}
var ATTENTION_SCORE_THRESHOLD, ATTENTION_TREND_THRESHOLD, WEEK_MS, labels1;
var init_dashboard = __esm({
  "src/js/dashboard.js"() {
    init_toast();
    init_utils();
    init_status();
    init_render();
    init_competency_profile();
    init_app_context();
    init_api();
    ATTENTION_SCORE_THRESHOLD = 70;
    ATTENTION_TREND_THRESHOLD = -15;
    WEEK_MS = 7 * 24 * 60 * 60 * 1e3;
    labels1 = {
      ASSESSMENT_LOADED: "Assessment Loaded",
      RUBRIC_LOADED: "Rubric Loaded",
      CONTEXT_BUILT: "Student Answer",
      EVIDENCE_EXTRACTED: "Evidence Extracted",
      VERIFICATION: "Verification",
      VERIFICATION_RUN: "Verification",
      FINAL_SCORE: "Deterministic Scoring \u2192 Final Score"
    };
  }
});

// src/js/observability.js
var observability_exports = {};
__export(observability_exports, {
  bindObservabilityEvents: () => bindObservabilityEvents,
  loadTelemetry: () => loadTelemetry
});
function bindObservabilityEvents(ctx) {
  const { els } = ctx;
  document.querySelectorAll(".ob-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ob-tab-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.querySelectorAll(".ob-section").forEach((s) => s.classList.remove("active"));
      const section = document.getElementById("ob-section-" + btn.dataset.obSection);
      if (section) section.classList.add("active");
    });
  });
  els.refreshTelemetryBtn?.addEventListener("click", () => {
    telemetryLogOffset = 0;
    loadTelemetry(ctx);
  });
  els.telemetryRange?.addEventListener("change", () => {
    telemetryLogOffset = 0;
    loadTelemetry(ctx);
  });
  ["telemetryFilterOp", "telemetryFilterModel", "telemetryFilterStatus", "telemetryFilterLatency", "telemetryFilterDate"].forEach(
    (id) => {
      els[id]?.addEventListener("change", () => {
        telemetryLogOffset = 0;
        setTelemetryLoading(ctx, true);
        fetchAndRenderTelemetry(ctx, { logs: true }).finally(() => setTelemetryLoading(ctx, false));
      });
    }
  );
  els.telemetryLogPrev?.addEventListener("click", () => {
    telemetryLogOffset = Math.max(0, telemetryLogOffset - LOG_PAGE_SIZE);
    setTelemetryLoading(ctx, true);
    fetchAndRenderTelemetry(ctx, { logs: true }).finally(() => setTelemetryLoading(ctx, false));
  });
  els.telemetryLogNext?.addEventListener("click", () => {
    telemetryLogOffset += LOG_PAGE_SIZE;
    setTelemetryLoading(ctx, true);
    fetchAndRenderTelemetry(ctx, { logs: true }).finally(() => setTelemetryLoading(ctx, false));
  });
}
async function loadTelemetry(ctx) {
  setTelemetryLoading(ctx, true);
  try {
    await fetchAndRenderTelemetry(ctx);
  } finally {
    setTelemetryLoading(ctx, false);
  }
}
function setTelemetryLoading(ctx, active) {
  const { els } = ctx;
  if (!els.refreshTelemetryBtn) return;
  setButtonLoading(els.refreshTelemetryBtn, active, "Memuat\u2026", "\u{1F504} Refresh Telemetry");
  els.refreshTelemetryBtn.setAttribute("aria-busy", String(active));
}
async function fetchAndRenderTelemetry(ctx, opts = {}) {
  const { els } = ctx;
  const seq = ++telemetryRequestSeq;
  const range = els.telemetryRange?.value || "24h";
  const params = new URLSearchParams({ range });
  params.set("limit", String(LOG_PAGE_SIZE));
  params.set("offset", String(telemetryLogOffset));
  if (opts.logs) {
    if (els.telemetryFilterOp?.value) params.set("operation", els.telemetryFilterOp.value);
    if (els.telemetryFilterModel?.value) params.set("model", els.telemetryFilterModel.value);
    if (els.telemetryFilterStatus?.value) params.set("status", els.telemetryFilterStatus.value);
    const latency = Number(els.telemetryFilterLatency?.value || 0);
    if (latency > 0) params.set("latency", String(latency));
    if (els.telemetryFilterDate?.value) params.set("dateFrom", els.telemetryFilterDate.value);
  }
  try {
    const response = await fetch(`/api/observability?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Gagal memuat data telemetry");
    if (seq !== telemetryRequestSeq) return;
    renderObservability(els, data);
  } catch (err) {
    if (seq !== telemetryRequestSeq) return;
    showToast(err.message || "Gagal memuat telemetry", "error");
  }
}
var telemetryRequestSeq, LOG_PAGE_SIZE, telemetryLogOffset;
var init_observability = __esm({
  "src/js/observability.js"() {
    init_render();
    init_toast();
    init_dom();
    telemetryRequestSeq = 0;
    LOG_PAGE_SIZE = 10;
    telemetryLogOffset = 0;
  }
});

// src/js/research.js
var research_exports = {};
__export(research_exports, {
  bindResearchEvents: () => bindResearchEvents,
  loadResearch: () => loadResearch
});
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Permintaan gagal");
  return data;
}
function fetchMetrics(assessmentId) {
  const qs = assessmentId ? `?action=metrics&assessmentId=${encodeURIComponent(assessmentId)}` : "?action=metrics";
  return fetchJson(`/api/research${qs}`);
}
function fetchRuns(assessmentId) {
  const qs = assessmentId ? `?action=runs&assessmentId=${encodeURIComponent(assessmentId)}` : "?action=runs";
  return fetchJson(`/api/research${qs}`);
}
function fetchRubric(assessmentId) {
  const qs = assessmentId ? `?action=rubric&assessmentId=${encodeURIComponent(assessmentId)}` : "?action=rubric";
  return fetchJson(`/api/research${qs}`);
}
function fetchTrace(runId) {
  return fetchJson(`/api/research?action=trace&runId=${encodeURIComponent(runId)}`);
}
function saveHumanScore(runId, humanScore, humanFeedback) {
  return fetchJson("/api/research", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save-human-score", payload: { runId, humanScore, humanFeedback } })
  });
}
function approveRun(runId, humanScore, humanFeedback) {
  return fetchJson("/api/research", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", payload: { runId, humanScore, humanFeedback } })
  });
}
function bindResearchEvents(ctx) {
  const { els } = ctx;
  els.researchSelect?.addEventListener("change", (e) => {
    renderResearch(ctx, e.target.value);
  });
  els.researchExportBtn?.addEventListener("click", () => exportBundle(ctx));
  els.refreshResearchBtn?.addEventListener("click", () => {
    renderResearch(ctx, els.researchSelect.value).catch((e) => showToast(e.message, "error"));
  });
  els.researchRunsList?.addEventListener("click", (e) => {
    const traceBtn = e.target.closest("[data-trace]");
    if (traceBtn) {
      openTrace(ctx, traceBtn.dataset.trace);
      return;
    }
    const exportBtn = e.target.closest("[data-export-run]");
    if (exportBtn) {
      exportSingleRun(ctx, exportBtn.dataset.exportRun);
    }
  });
  els.researchResultPanel?.addEventListener("click", async (e) => {
    if (e.target.classList.contains("research-close-btn")) {
      els.researchResultPanel.classList.add("hidden");
      return;
    }
    if (e.target.id === "saveHumanScoreBtn") {
      const runId = els.researchResultPanel.dataset.runId;
      const score = Number(els.researchResultPanel.querySelector("#humanScoreInput")?.value);
      const feedback = els.researchResultPanel.querySelector("#humanScoreFeedback")?.value || "";
      if (!runId) return;
      try {
        if (!Number.isFinite(score) || score < 0 || score > 100) {
          throw new Error("Skor manusia harus angka 0-100");
        }
        await saveHumanScore(runId, score, feedback);
        showToast("Skor manusia disimpan", "success");
        els.researchResultPanel.classList.add("hidden");
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    if (e.target.id === "approveAiScoreBtn") {
      const runId = els.researchResultPanel.dataset.runId;
      const scoreInput = els.researchResultPanel.querySelector("#humanScoreInput")?.value;
      const feedback = els.researchResultPanel.querySelector("#humanScoreFeedback")?.value || "";
      if (!runId) return;
      try {
        let humanScore;
        if (scoreInput !== void 0 && String(scoreInput).trim() !== "") {
          humanScore = Number(scoreInput);
          if (!Number.isFinite(humanScore) || humanScore < 0 || humanScore > 100) {
            throw new Error("Skor koreksi harus angka 0-100, atau kosongkan untuk pakai skor AI");
          }
        }
        await approveRun(runId, humanScore, feedback);
        showToast(humanScore === void 0 ? "Skor AI di-approve" : "Skor disetujui dengan koreksi", "success");
        els.researchResultPanel.classList.add("hidden");
      } catch (err) {
        showToast(err.message, "error");
      }
    }
  });
}
async function loadResearch(ctx) {
  await renderResearch(ctx, "");
}
async function renderResearch(ctx, assessmentId) {
  const { els } = ctx;
  if (!els.researchSelect) return;
  if (els.researchSelect.options.length <= 1) {
    const assessments = ctx.state && ctx.state.assessments || [];
    els.researchSelect.innerHTML = '<option value="">Semua assessment</option>' + assessments.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.topic)}</option>`).join("");
  }
  els.researchSelect.value = assessmentId || "";
  const [metrics, runs, rubric] = await Promise.all([
    fetchMetrics(assessmentId).catch(() => null),
    fetchRuns(assessmentId),
    fetchRubric(assessmentId).catch(() => null)
  ]);
  renderMetrics(els, metrics);
  renderRuns(els, runs ? runs.runs || [] : []);
  renderRubric(els, rubric);
}
function fmt(v, digits = 3) {
  if (v === null || v === void 0 || Number.isNaN(v)) return "-";
  return typeof v === "number" ? v.toFixed(digits) : String(v);
}
function fmtWeightPct(weight) {
  const pct = (Number(weight) || 0) * 100;
  if (Number.isInteger(pct)) return String(pct);
  return pct.toFixed(1).replace(/\.0$/, "");
}
function renderMetrics(els, data) {
  const m = data && data.metrics;
  const total = data && data.n ? data.n : 0;
  if (!m) {
    els.researchValidity.innerHTML = '<p class="empty-state">Belum ada pasangan AI-vs-Human. Beri skor manusia pada sebuah trace untuk melihat metrik validitas.</p>';
    els.researchInterRater.innerHTML = '<p class="empty-state">Belum ada pasangan skor untuk metrik reliabilitas.</p>';
    return;
  }
  const card = (label, value, pct, hint) => `
    <div class="metric-card" style="display:flex;flex-direction:column;justify-content:space-between;" title="${escapeHtml(hint || "")}">
      <span style="font-size:0.85rem;color:var(--muted);font-weight:500;">${label}</span>
      <strong style="font-size:1.4rem;font-weight:700;margin:8px 0;">${pct ? fmt(value * 100, 1) + "%" : fmt(value)}</strong>
      <span class="metric-hint" style="font-size:0.72rem;color:var(--muted);line-height:1.35;">${escapeHtml(hint || "")}</span>
    </div>`;
  els.researchValidity.innerHTML = `<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">${total} pasangan AI vs human</p>` + card("Pearson", m.validity.pearson, false, "Koefisien korelasi linier antara skor AI dan skor manusia. Nilai mendekati 1 menandakan keselarasan yang kuat; mendekati 0 menandakan tidak ada korelasi.") + card("Spearman", m.validity.spearman, false, "Korelasi berbasis peringkat yang lebih tahan terhadap nilai ekstrem dibandingkan Pearson, mengukur konsistensi urutan antar-penilai.") + card("MAE", m.validity.mae, false, "Rata-rata absolut selisih antara skor AI dan skor manusia. Semakin rendah (idealnya di bawah 5) semakin akurat prediksi AI.") + card("RMSE", m.validity.rmse, false, "Akar rata-rata kuadrat selisih skor. Memberi bobot lebih besar pada selisih yang besar sehingga sensitif terhadap anomali penilaian.") + card("Exact agreement", m.reliability.exactAgreement, true, "Proporsi penilaian di mana skor AI dan skor manusia bernilai identik.") + card("Adjacent (+/-5)", m.reliability.adjacentAgreement, true, "Proporsi penilaian dengan selisih skor maksimal 5 poin antara AI dan manusia.");
  const ir = data.interRater;
  if (els.researchInterRater) {
    if (!ir || ir.icc == null && ir.cohensKappa == null && ir.weightedKappa == null) {
      els.researchInterRater.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">' + total + ' pasangan skor</p><p class="empty-state">Metrik reliabilitas belum tersedia (butuh variasi skor).</p>';
    } else {
      const irCard = (label, value, hint) => `
        <div class="metric-card" style="display:flex;flex-direction:column;justify-content:space-between;" title="${escapeHtml(hint || "")}">
          <span style="font-size:0.85rem;color:var(--muted);font-weight:500;">${label}</span>
          <strong style="font-size:1.4rem;font-weight:700;margin:8px 0;">${fmt(value)}</strong>
          <span class="metric-hint" style="font-size:0.72rem;color:var(--muted);line-height:1.35;">${escapeHtml(hint || "")}</span>
        </div>`;
      els.researchInterRater.innerHTML = `<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">${ir.n ?? total} pasangan AI vs human</p>` + irCard("Cohen's Kappa", ir.cohensKappa, "Indeks kesepakatan antara AI dan manusia setelah dikurangi peluang kebetulan. Nilai di atas 0,6 menandakan kesepakatan yang baik.") + irCard("Weighted Kappa", ir.weightedKappa, "Varian Cohen's Kappa yang memperhitungkan besarnya selisih; selisih kecil dikenai penalti lebih ringan dibanding selisih besar.") + irCard("ICC (2-way)", ir.icc, "Konsistensi antar-penilai. Nilai mendekati 1 menandakan konsistensi tinggi; di bawah 0,5 menandakan konsistensi rendah.");
    }
  }
}
function renderRuns(els, runs) {
  els.researchRunsList.innerHTML = runs.length ? runs.map((r) => {
    const status = approvalBadge(r.approval_status, r.human_score);
    const gate = gateBadge(r.verification_status, r.verification_valid);
    const versions = [
      r.harness_version ? `harness ${r.harness_version}` : null,
      r.prompt_version ? `prompt ${r.prompt_version}` : null
    ].filter(Boolean).join(" \xB7 ");
    return `
      <tr>
        <td>${escapeHtml(r.run_id)}</td>
        <td>${escapeHtml((r.assessment_id || "").slice(0, 20))}</td>
        <td>${escapeHtml(r.model || "-")}</td>
        <td style="font-size:0.8rem;color:var(--muted);">${versions ? escapeHtml(versions) : "\u2014"}</td>
        <td>${r.final_score ?? "-"}</td>
        <td>${gate}</td>
        <td>${status}</td>
        <td style="white-space:nowrap;">
          <button type="button" class="secondary-button" data-trace="${escapeHtml(r.run_id)}">Trace</button>
          <button type="button" class="secondary-button" data-export-run="${escapeHtml(r.run_id)}" title="Unduh detail lengkap">\u{1F4E5}</button>
        </td>
      </tr>`;
  }).join("") : '<tr><td colspan="8" class="empty-state">Belum ada run evaluasi.</td></tr>';
  els.researchRunsList.style.display = "";
}
function gateBadge(status, verificationValid) {
  const s = status || (verificationValid ? "PASS" : "FAIL");
  const map = {
    PASS: { label: "PASS", cls: "badge-ok", title: "Verification gate lolos \u2014 skor dapat diterbitkan" },
    REVIEW: { label: "REVIEW", cls: "badge-warn", title: "Perlu tinjauan manusia (kepercayaan rendah)" },
    FAIL: { label: "FAIL", cls: "badge-bad", title: "Evaluasi gagal verifikasi \u2014 tidak boleh diterbitkan" }
  };
  const info = map[s] || { label: s || "-", cls: "badge-muted" };
  return `<span class="badge ${info.cls}" title="${escapeHtml(info.title || "")}">${escapeHtml(info.label)}</span>`;
}
function approvalBadge(status, humanScore) {
  const map = {
    approved: { label: "Approved", cls: "badge-ok" },
    auto_approved: { label: "Auto \u2713", cls: "badge-warn", title: "Otomatis dikonfirmasi setelah 7 hari tanpa aksi" },
    approved_human_correction: { label: "Dikoreksi Manusia", cls: "badge-ok", title: "Skor diperbaiki oleh manusia \u2014 nilai manusia dipakai, bukan skor AI" },
    human_reviewed: { label: "Ditinjau Manusia", cls: "badge-ok", title: "Ditinjau/dikoreksi oleh manusia \u2014 tidak lagi memakai skor AI" },
    pending: { label: "Pending", cls: "badge-muted", title: "Menunggu tinjauan guru (jendela 7 hari)" },
    rejected: { label: "Rejected", cls: "badge-bad" }
  };
  const info = map[status] || { label: status || "-", cls: "badge-muted" };
  const hs = humanScore != null ? ` \xB7 skor ${humanScore}` : "";
  return `<span class="badge ${info.cls}" ${info.title ? `title="${escapeHtml(info.title)}"` : ""}>${escapeHtml(info.label)}</span><span style="font-size:0.8rem;color:var(--muted);">${hs}</span>`;
}
function renderRubric(els, data) {
  if (!els.researchRubricPanel) return;
  const n = data && data.n ? data.n : 0;
  const coverage = data && data.criterionCoverage ? data.criterionCoverage : 0;
  els.researchRubricPanel.innerHTML = n ? `
      <p>Rata-rata criterion per run: <strong>${coverage.toFixed(2)}</strong></p>
      <p class="metric-hint" style="font-size:0.75rem;color:var(--muted);margin-top:-4px;">Rata-rata jumlah aspek rubrik yang dievaluasi pada tiap run evaluasi.</p>
      <p>Total criterion rows: <strong>${data.totalCriterionRows || 0}</strong></p>
      <p class="metric-hint" style="font-size:0.75rem;color:var(--muted);margin-top:-4px;">Total seluruh penilaian aspek rubrik yang dicatat di semua run.</p>
      <p>Jumlah run: <strong>${n}</strong></p>
      <p class="metric-hint" style="font-size:0.75rem;color:var(--muted);margin-top:-4px;">Banyaknya evaluasi (run) yang pernah dijalankan oleh sistem.</p>` : '<p class="empty-state">Belum ada data rubric compliance.</p>';
}
async function openTrace(ctx, runId) {
  const { els } = ctx;
  try {
    const trace = await fetchTrace(runId);
    const result = trace.result || {};
    const criteria = Array.isArray(result.criteria) ? result.criteria : [];
    const versions = trace.versions || {};
    const weighted = result.weighted || {};
    const detailRows = Array.isArray(weighted.detail) ? weighted.detail : [];
    const events = trace.events || [];
    const labelById = new Map(detailRows.map((d) => [String(d.criterionId), d.label]));
    const breakdownHtml = detailRows.length ? `
      <ul style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px;">
        ${detailRows.map(
      (d) => `
          <li style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <span style="min-width:0;overflow-wrap:break-word;">${escapeHtml(d.label || prettifyId(d.criterionId))}</span>
            <span style="flex-shrink:0;color:var(--muted);font-variant-numeric:tabular-nums;">
              ${fmt(d.score, 0)} \xD7 ${fmtWeightPct(d.weight)}%
              <span style="color:var(--success-strong);font-weight:700;">= ${fmt(d.contribution, 2)}</span>
            </span>
          </li>`
    ).join("")}
      </ul>` : `<strong>${fmt(result.finalScore, 1)}</strong>`;
    const formulaHtml = detailRows.length ? `<div style="font-size:0.95rem;">${breakdownHtml}<div style="margin-top:10px;font-size:1.4rem;font-weight:700;">= ${fmt(result.finalScore, 1)}</div></div>` : `<strong>${fmt(result.finalScore, 1)}</strong>`;
    const criteriaHtml = criteria.map(
      (c) => `
        <div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(labelById.get(String(c.criterionId)) || prettifyId(c.criterionId))}</strong>
            <span style="font-weight:700;font-size:1.1rem;">${fmt(c.score, 0)}<span style="color:var(--muted);font-size:0.8rem;">/100</span></span>
          </div>
          ${typeof c.confidence === "number" ? `<div style="font-size:0.8rem;color:var(--muted);margin-top:2px;">Kepercayaan: ${fmt(c.confidence * 100, 0)}%</div>` : ""}
          ${c.noEvidence ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--warning-strong);"><strong>TANPA EVIDENCE</strong> \u2014 criterion tanpa bukti jawaban (FR-03)</div>` : Array.isArray(c.evidence) && c.evidence.length ? `<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--muted);">Evidence:</span><ul style="margin:4px 0 0 18px;">${c.evidence.map((ev) => {
        const verdict = ev.grounded ? `<span style="color:var(--emerald);font-size:0.75rem;"> \u2713 grounded</span>` : `<span style="color:var(--danger-strong);font-size:0.75rem;"> \u2717 tidak grounded</span>`;
        const method = ev.groundingMethod ? ` <span style="color:var(--muted);font-size:0.7rem;">(${escapeHtml(ev.groundingMethod)})</span>` : "";
        return `<li>${escapeHtml(ev.text || "")}${verdict}${method}</li>`;
      }).join("")}</ul></div>` : ""}
          ${c.rationale ? `<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--muted);">Alasan:</span> ${escapeHtml(c.rationale)}</div>` : ""}
        </div>`
    ).join("") || '<p class="empty-state">Tanpa criterion</p>';
    const questionRubric = Array.isArray(result.questionRubric) ? result.questionRubric : [];
    const questionRubricHtml = questionRubric.length ? `
        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <span style="color:var(--muted);font-size:0.85rem;">Pemetaan soal \u2192 rubrik</span>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">
            ${questionRubric.map(
      (q) => `
              <div style="border:1px solid var(--line);border-radius:8px;padding:10px;">
                <div style="font-size:0.9rem;font-weight:600;">Soal ${q.index + 1}</div>
                <div style="font-size:0.85rem;color:var(--muted);margin:2px 0 8px;">${escapeHtml(q.prompt || "")}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${(q.criteria || []).map(
        (c) => `
                    <span style="font-size:0.75rem;padding:3px 8px;border-radius:999px;background:var(--brand-soft);color:var(--text);border:1px solid var(--line);">
                      ${escapeHtml(c.name || prettifyId(c.id))} \xB7 ${fmtWeightPct(c.weight)}%
                    </span>`
      ).join("")}
                </div>
              </div>`
    ).join("")}
          </div>
        </div>` : "";
    const gate = gateBadge(result.verification?.status, result.verification?.valid);
    const reliability = result.reliability;
    const reliabilityHtml = reliability && reliability.dimensions ? `
        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:var(--muted);font-size:0.85rem;">Reliability sistem</span>
            <strong style="font-size:1.2rem;">${fmt(reliability.overallReliability * 100, 0)}%</strong>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
            ${Object.entries(reliability.dimensions).map(([k, v]) => {
      const def = reliabilityDimensionDefs[k] || { label: prettifyId(k), desc: "" };
      return `<div class="rt-dim" style="font-size:0.8rem;" data-tip="${escapeHtml(def.desc)}" title="${escapeHtml(def.label)}">
                  <span class="rt-dim-label" style="color:var(--muted);display:block;">${escapeHtml(def.label)}</span>
                  <strong>${fmt(v * 100, 1)}%</strong>
                </div>`;
    }).join("")}
          </div>
          <p class="hint" style="font-size:0.7rem;color:var(--muted);margin-top:8px;">Pisah dari kepercayaan model: indicator keandalan keputusan (FR-10). Arahkan kursor ke tiap dimensi untuk penjelasan.</p>
        </div>` : "";
    els.researchResultPanel.dataset.runId = runId;
    els.researchResultPanel.innerHTML = `
      <div class="result-modal-content">
        <button type="button" class="result-close-btn research-close-btn">&times;</button>
        <p class="eyebrow">${escapeHtml(runId)}</p>
        <h3>Trace Evaluasi</h3>
        <p>Assessment: <strong>${escapeHtml(result.assessmentId || "-")}</strong> \xB7 Verification gate: ${gate}</p>

        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <span style="color:var(--muted);font-size:0.85rem;">Skor akhir (deterministik)</span>
          <div style="font-size:1.6rem;font-weight:700;">${formulaHtml}</div>
        </div>

        ${questionRubricHtml}
        ${reliabilityHtml}
        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <label>Skor manusia
            <input id="humanScoreInput" type="number" min="0" max="100" placeholder="Tilai manual 0-100" />
          </label>
          <label>Penilai
            <input id="humanReviewer" type="text" value="${escapeHtml(ctx.auth && ctx.auth.user && ctx.auth.user.name || "")}" disabled />
          </label>
          <label>Ulasan
            <textarea id="humanScoreFeedback" rows="2" placeholder="Catatan penilai manusia (opsional)"></textarea>
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button class="primary-button" id="approveAiScoreBtn" type="button">\u2713 Approve skor AI</button>
            <button class="secondary-button" id="saveHumanScoreBtn" type="button">Simpan skor manual</button>
          </div>
        </div>
        <p class="hint" style="font-size:0.8rem;color:var(--muted);margin-top:8px;">
          Skor AI ${escapeHtml(result.finalScore ?? "-")}. Approve menyimpan skor AI sebagai penilaian manusia. 
          Kosongkan skor manual lalu tekan "Approve skor AI" untuk konfirmasi tanpa koreksi.
        </p>

        <details style="margin-top:16px;">
          <summary style="cursor:pointer;font-weight:600;">Teknis, versi &amp; events (detail lengkap)</summary>
          <p style="font-size:0.85rem;color:var(--muted);margin-top:8px;">
            Model: <strong>${escapeHtml(versions.model_version || result.versioning?.modelVersion || "-")}</strong> \xB7
            Prompt <strong>${escapeHtml(versions.prompt_version || result.versioning?.promptVersion || "-")}</strong> \xB7
            Rubric <strong>${escapeHtml(versions.rubric_version || result.versioning?.rubricVersion || "-")}</strong> \xB7
            Harness <strong>${escapeHtml(versions.harness_version || result.versioning?.harnessVersion || "-")}</strong> \xB7
            Engine <strong>${escapeHtml(versions.engine_version || result.versioning?.engineVersion || "-")}</strong>
          </p>
          <pre class="ai-stream-content">${escapeHtml(JSON.stringify(events, null, 2))}</pre>
        </details>
      </div>`;
    const scoreInput = els.researchResultPanel.querySelector("#humanScoreInput");
    if (scoreInput) scoreInput.value = "";
    els.researchResultPanel.classList.remove("hidden");
  } catch (err) {
    showToast(err.message, "error");
  }
}
async function exportSingleRun(ctx, runId) {
  try {
    const data = await fetchJson(`/api/research?action=trace&runId=${encodeURIComponent(runId)}`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisanai-trace-${runId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, "error");
  }
}
async function exportBundle(ctx) {
  const { els } = ctx;
  const assessmentId = els.researchSelect?.value || "";
  const qs = assessmentId ? `?action=export&assessmentId=${encodeURIComponent(assessmentId)}` : "?action=export";
  try {
    const data = await fetchJson(`/api/research${qs}`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisanai-research-${assessmentId || "all"}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, "error");
  }
}
var reliabilityDimensionDefs;
var init_research = __esm({
  "src/js/research.js"() {
    init_utils();
    init_toast();
    reliabilityDimensionDefs = {
      evidenceGrounding: {
        label: "Grounded Evidence",
        desc: "Proporsi kriteria yang skornya didukung bukti yang benar-benar ter-ground di jawaban siswa. Semakin tinggi, makin kuat dasar penilaiannya."
      },
      criterionCoverage: {
        label: "Cakupan Kriteria",
        desc: "Proporsi kriteria rubrik yang benar-benar dievaluasi pada run ini. Nilai 100% berarti seluruh aspek rubrik dinilai."
      },
      rubricAlignment: {
        label: "Kesesuaian Rubrik",
        desc: "Seberapa konsisten keyakinan model (confidence) dengan sistem skor rubrik. Nilai rendah menandakan skor & keyakinan kurang selaras."
      },
      scoreConsistency: {
        label: "Konsistensi Skor",
        desc: "Kekonsistenan skor: proporsi skor yang didukung bukti serta tidak ada anomali sel. Semakin tinggi semakin andal skornya."
      },
      outputValidity: {
        label: "Validitas Output",
        desc: "Kesesuaian output model dengan skema yang diharapkan (struktur JSON valid). Menjamin hasil dapat diparse dan dipakai dengan aman."
      }
    };
  }
});

// src/js/api-keys.js
var api_keys_exports = {};
__export(api_keys_exports, {
  bindApiKeyEvents: () => bindApiKeyEvents,
  loadApiKeys: () => loadApiKeys
});
function bindApiKeyEvents(ctx) {
  const { els } = ctx;
  if (els.createApiKeyBtn) {
    els.createApiKeyBtn.addEventListener("click", async () => {
      const name = els.apiKeyName.value.trim();
      if (!name) {
        showToast("Nama API key wajib diisi", "error");
        return;
      }
      els.createApiKeyBtn.disabled = true;
      try {
        const { postJson: postJson2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const data = await postJson2("/api/apikeys", { action: "create", payload: { name } }, "Gagal membuat API key");
        els.apiKeyValue.textContent = data.key;
        els.apiKeyResult.classList.remove("hidden");
        els.apiKeyName.value = "";
        showToast("API key berhasil dibuat", "success");
        await loadApiKeys(ctx);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        els.createApiKeyBtn.disabled = false;
      }
    });
  }
  if (els.apiKeyList) {
    els.apiKeyList.addEventListener("click", async (e) => {
      const revokeBtn = e.target.closest(".revoke-api-key-btn");
      if (!revokeBtn) return;
      const keyId = revokeBtn.dataset.keyId;
      if (!await showConfirmDialog("Revoke API key ini? Sistem eksternal yang memakainya tidak akan bisa mengakses lagi.", "Revoke API Key")) return;
      try {
        const { postJson: postJson2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        await postJson2("/api/apikeys", { action: "revoke", payload: { keyId } }, "Gagal revoke API key");
        showToast("API key di-revoke", "success");
        await loadApiKeys(ctx);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}
async function loadApiKeys(ctx) {
  const { els } = ctx;
  if (!els.apiKeyList) return;
  try {
    const response = await fetch("/api/apikeys", { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Gagal memuat API key");
    renderApiKeys(ctx, data.keys || []);
  } catch (err) {
    showToast(err.message, "error");
  }
}
function renderApiKeys(ctx, keys) {
  const { els } = ctx;
  if (!keys.length) {
    els.apiKeyList.className = "list-stack empty-state";
    els.apiKeyList.textContent = "Belum ada API key.";
    return;
  }
  els.apiKeyList.className = "list-stack";
  els.apiKeyList.innerHTML = keys.map((key) => `
    <article class="list-item" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div style="flex:1; min-width:0;">
        <strong>${escapeHtml(key.name)}</strong>
        <p style="font-size:0.85rem; color:var(--muted);">${escapeHtml(key.prefix)}\u2026 \xB7 Dibuat ${escapeHtml(new Date(key.createdAt).toLocaleDateString("id-ID"))}${key.lastUsedAt ? ` \xB7 Terakhir dipakai ${escapeHtml(new Date(key.lastUsedAt).toLocaleString("id-ID"))}` : ""}</p>
      </div>
      <button type="button" class="action-button danger-button revoke-api-key-btn" data-key-id="${escapeHtml(key.id)}">Revoke</button>
    </article>
  `).join("");
}
var init_api_keys = __esm({
  "src/js/api-keys.js"() {
    init_toast();
    init_utils();
  }
});

// src/js/notifications.js
var notifications_exports = {};
__export(notifications_exports, {
  clearNotificationBadge: () => clearNotificationBadge,
  getNotificationCount: () => getNotificationCount,
  startNotificationListener: () => startNotificationListener,
  stopNotificationListener: () => stopNotificationListener
});
function startNotificationListener(ctx) {
  stopNotificationListener();
  try {
    notifEventSource = new EventSource("/api/notifications");
    notifEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleNotification(ctx, data);
      } catch {
      }
    };
    notifEventSource.onerror = () => {
    };
  } catch {
  }
}
function stopNotificationListener() {
  if (notifEventSource) {
    notifEventSource.close();
    notifEventSource = null;
  }
}
function handleNotification(ctx, data) {
  const { type, title, message, assessmentId } = data;
  if (type === "submission" || type === "complaint") {
    notifCount += 1;
    updateBadge(ctx);
    showToast(`${title}: ${message}`, "info");
    const { els } = ctx;
    if (els.notifList) {
      const notif = document.createElement("div");
      notif.className = "feedback-card";
      notif.style.borderLeft = "4px solid var(--accent)";
      notif.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <p style="color:var(--muted); font-size:0.9rem; margin:4px 0;">${escapeHtml(message)}</p>
            <small style="color:var(--muted);">${(/* @__PURE__ */ new Date()).toLocaleTimeString("id-ID")}</small>
          </div>
          ${assessmentId ? `<button type="button" class="secondary-button" onclick="window.dispatchEvent(new CustomEvent('notif-view-assessment', {detail:{id:'${assessmentId}'}}))" style="flex-shrink:0; font-size:0.85rem;">Lihat</button>` : ""}
        </div>
      `;
      const empty = els.notifList.querySelector(".empty-state");
      if (empty) empty.remove();
      els.notifList.prepend(notif);
      while (els.notifList.children.length > 20) {
        els.notifList.lastElementChild.remove();
      }
    }
  }
}
function updateBadge(ctx) {
  const { els } = ctx;
  if (els.notifBadge) {
    els.notifBadge.textContent = String(notifCount);
    els.notifBadge.classList.toggle("hidden", notifCount === 0);
  }
}
function clearNotificationBadge() {
  notifCount = 0;
  const badge = document.getElementById("notifBadge");
  if (badge) badge.classList.add("hidden");
}
function getNotificationCount() {
  return notifCount;
}
var notifEventSource, notifCount;
var init_notifications = __esm({
  "src/js/notifications.js"() {
    init_toast();
    init_utils();
    notifEventSource = null;
    notifCount = 0;
  }
});

// src/js/app-context.js
var app_context_exports = {};
__export(app_context_exports, {
  applyRoleAccess: () => applyRoleAccess,
  bootstrapAuthenticatedApp: () => bootstrapAuthenticatedApp,
  canAccessView: () => canAccessView,
  clearAuthForms: () => clearAuthForms,
  closeRegisterModal: () => closeRegisterModal,
  closeResultModal: () => closeResultModal,
  createAppContext: () => createAppContext,
  handleModalKeyboard: () => handleModalKeyboard,
  isAssessmentLocked: () => isAssessmentLocked,
  loadUsers: () => loadUsers,
  openRegisterModal: () => openRegisterModal,
  refreshSimulator: () => refreshSimulator,
  refreshSimulatorIfEnabled: () => refreshSimulatorIfEnabled,
  renderCurrentState: () => renderCurrentState2,
  renderSimulator: () => renderSimulator,
  roleLabel: () => roleLabel,
  setAssessmentTab: () => setAssessmentTab,
  showApp: () => showApp,
  showAuth: () => showAuth,
  switchView: () => switchView,
  trapFocus: () => trapFocus
});
function createAppContext() {
  const els = getElements();
  const recorder = createRecorder({
    recordButton: els.recordButton,
    recordStatus: els.recordStatus,
    answerText: els.answerText,
    recordTimer: els.recordTimer,
    volumeIndicator: els.volumeIndicator
  });
  return {
    els,
    recorder,
    auth: null,
    state: { assessments: [], submissions: [], classes: [], memberships: [] },
    users: [],
    session: null,
    pendingAssessmentConfig: null,
    pendingQuestions: [],
    isEvaluating: false,
    lastModalTrigger: null,
    micCheck: null,
    pendingExamAssessmentId: null,
    preExamTrigger: null,
    isStartingExam: false,
    currentWizardStep: 1,
    memberSearchQuery: "",
    memberCurrentPage: 1,
    MEMBERS_PER_PAGE: 10,
    questionTimerInterval: null,
    currentQuestionTimeLeft: 0,
    questionStartTime: Date.now(),
    currentViewId: null
  };
}
async function bootstrapAuthenticatedApp(ctx, nextAuth) {
  ctx.auth = nextAuth;
  ctx.state = await loadState();
  ctx.session = createSession(ctx.state);
  ctx.users = ctx.auth.user.role === "admin" ? await loadUsers(ctx) : [];
  clearAuthForms(ctx);
  showApp(ctx);
  applyRoleAccess(ctx);
  await renderCurrentState2(ctx);
  const { renderUsers: renderUsers2 } = await Promise.resolve().then(() => (init_user_management(), user_management_exports));
  renderUsers2(ctx);
  refreshSimulatorIfEnabled(ctx);
}
async function loadUsers(ctx) {
  try {
    return await listUsers();
  } catch (error) {
    showToast(`Gagal memuat user tenant: ${error.message}`);
    return [];
  }
}
function showAuth(ctx) {
  const { els } = ctx;
  els.authView.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  closeRegisterModal(ctx);
  closeResultModal(ctx);
}
function showApp(ctx) {
  const { els, auth } = ctx;
  els.authView.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  closeRegisterModal(ctx);
  els.accountName.textContent = auth.user.name;
  els.tenantName.textContent = auth.tenant.name;
  els.accountRole.textContent = roleLabel(auth.user.role);
}
function clearAuthForms(ctx) {
  ctx.els.loginForm.reset();
  ctx.els.registerForm.reset();
}
function openRegisterModal(ctx) {
  const { els } = ctx;
  if (els.registerModal) {
    ctx.lastModalTrigger = document.activeElement;
    els.registerModal.classList.remove("hidden");
    if (els.registerTenant) els.registerTenant.focus();
  }
}
function closeRegisterModal(ctx) {
  const { els } = ctx;
  if (els.registerModal) {
    els.registerModal.classList.add("hidden");
    if (ctx.lastModalTrigger instanceof HTMLElement && document.contains(ctx.lastModalTrigger)) ctx.lastModalTrigger.focus();
    ctx.lastModalTrigger = null;
  }
}
function closeResultModal(ctx) {
  const { els } = ctx;
  if (!els.resultPanel || els.resultPanel.classList.contains("hidden")) return;
  els.resultPanel.classList.add("hidden");
  const returnFocus = els.resultPanel._returnFocus;
  if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus();
}
function trapFocus(event, modal) {
  const focusable = [...modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.closest(".hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function handleModalKeyboard(ctx, event) {
  const { els } = ctx;
  const registerOpen = els.registerModal && !els.registerModal.classList.contains("hidden");
  const resultOpen = els.resultPanel && !els.resultPanel.classList.contains("hidden");
  if (!registerOpen && !resultOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (resultOpen) closeResultModal(ctx);
    else closeRegisterModal(ctx);
    return;
  }
  if (event.key === "Tab") trapFocus(event, resultOpen ? els.resultPanel : els.registerModal);
}
function isAssessmentLocked(ctx, assessment) {
  if (!assessment) return false;
  if (assessment.status === "closed") return true;
  const studentSubmissions = ctx.state.submissions.filter((submission) => submission.assessmentId === assessment.id);
  const used = studentSubmissions.length;
  if (assessment.allowRetakes) return false;
  const maxAttempts = Number(assessment.maxAttempts) || 1;
  return used >= maxAttempts;
}
async function renderCurrentState2(ctx) {
  const { els, auth, session, state } = ctx;
  if (auth.user?.role !== "student") {
    session.ensureAssessmentSelected();
  } else {
    if (session.currentAssessmentId && !state.assessments.some((a) => a.id === session.currentAssessmentId)) {
      session.currentAssessmentId = null;
    }
    const currentAssessment = session.getCurrentAssessment();
    if (currentAssessment && isAssessmentLocked(ctx, currentAssessment)) {
      session.currentAssessmentId = null;
      session.currentAnswers = [];
      session.currentQuestionIndex = 0;
    }
  }
  renderApp(els, state, session);
  if (auth.user) renderStudentHistory(els, state.submissions, auth.user.name);
  const { renderClasses: renderClasses2 } = await Promise.resolve().then(() => (init_class_management(), class_management_exports));
  const { renderQuestionEditor: renderQuestionEditor2 } = await Promise.resolve().then(() => (init_assessment_wizard(), assessment_wizard_exports));
  renderClasses2(ctx);
  renderQuestionEditor2(ctx);
  const { renderComplaints: renderComplaints2, updateComplaintBadge: updateComplaintBadge2, notifyStudentComplaintStatus: notifyStudentComplaintStatus2 } = await Promise.resolve().then(() => (init_complaints(), complaints_exports));
  if (auth.user?.role === "teacher") {
    renderComplaints2(ctx);
    updateComplaintBadge2(ctx);
  } else if (auth.user?.role === "student") {
    notifyStudentComplaintStatus2(ctx);
  }
  const hasData = state.assessments.length > 0;
  const isDev = window.ENABLE_DEMO_SIMULATION === "true" || window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const devTools = document.querySelectorAll(".sidebar-settings");
  devTools.forEach((el) => el.classList.toggle("hidden", !isDev));
  if (els.seedDemoTeacher) els.seedDemoTeacher.classList.toggle("hidden", hasData);
  if (els.seedDemoAdmin) els.seedDemoAdmin.classList.toggle("hidden", hasData);
  if (els.seedDemo) els.seedDemo.classList.toggle("hidden", hasData);
  if (els.removeDemoData) els.removeDemoData.classList.toggle("hidden", auth.user?.role === "student" || !hasData);
  if (auth.user?.role === "student") {
    els.studentName.value = auth.user.name;
    els.studentName.readOnly = true;
    if (session.getCurrentAssessment()?.oralExamEnabled === false) ctx.recorder.setEnabled(false);
  } else {
    els.studentName.readOnly = false;
  }
}
function applyRoleAccess(ctx) {
  const { els, auth } = ctx;
  const role = auth.user.role;
  if (els.seedDemo) els.seedDemo.classList.toggle("hidden", role === "student");
  if (els.seedDemoTeacher) els.seedDemoTeacher.classList.toggle("hidden", role === "student");
  if (els.seedDemoAdmin) els.seedDemoAdmin.classList.toggle("hidden", role !== "admin");
  if (els.removeDemoData) els.removeDemoData.classList.toggle("hidden", role === "student");
  document.body.classList.remove("teacher-mode", "student-mode", "admin-mode");
  let navHtml = "";
  if (role === "teacher") {
    navHtml = `
      <button class="nav-button" data-view="dashboardView"><span aria-hidden="true">\u25A6</span> Dashboard</button>
      <div class="nav-group">
        <button class="nav-button" data-view="assessmentListView" aria-haspopup="true" aria-expanded="true">
          <span aria-hidden="true">\u2318</span> Penilaian <span class="nav-caret" aria-hidden="true">\u25BE</span>
        </button>
        <div class="nav-sub nav-group-open">
          <button class="nav-sub-item" data-nav-view="teacherView">\u271A Buat Penilaian</button>
          <button class="nav-sub-item" data-nav-assessment-tab="all">Semua Penilaian</button>
          <button class="nav-sub-item" data-nav-assessment-tab="draft">Draft</button>
          <button class="nav-sub-item" data-nav-assessment-tab="published">Published</button>
        </div>
      </div>
      <button class="nav-button" data-view="manageClassView"><span aria-hidden="true">\u{1F465}</span> Kelas</button>
      <button class="nav-button" data-view="studentProfileView"><span aria-hidden="true">\u25C9</span> Siswa</button>
      <button class="nav-button" data-view="monitorView"><span aria-hidden="true">\u25A4</span> Monitoring</button>
      <button class="nav-button" data-view="questionBankView"><span aria-hidden="true">\u{1F4E6}</span> Bank Soal</button>
      <button class="nav-button" data-view="notifView"><span aria-hidden="true">\u{1F514}</span> Notifikasi <span id="notifBadge" class="nav-badge hidden">0</span></button>
      <button class="nav-button" data-view="complaintView"><span aria-hidden="true">\u{1F4E9}</span> Komplain <span id="complaintNavBadge" class="nav-badge hidden">0</span></button>
    `;
  } else if (role === "student") {
    navHtml = `
      <button class="nav-button" data-view="studentView"><span aria-hidden="true">\u25C9</span> Kerjakan</button>
      <button class="nav-button" data-view="studentHistoryView"><span aria-hidden="true">\u{1F552}</span> Riwayat</button>
      <button class="nav-button" data-view="studentNotifView"><span aria-hidden="true">\u{1F4E9}</span> Notifikasi</button>
    `;
  } else if (role === "admin") {
    navHtml = `
      <button class="nav-button" data-view="observabilityView"><span aria-hidden="true">\u{1F4C8}</span> Observabilitas</button>
      <button class="nav-button" data-view="researchView"><span aria-hidden="true">\u{1F9EA}</span> Riset</button>
      <button class="nav-button" id="adminNav" data-view="accountView"><span aria-hidden="true">\u{1F464}</span> Akun</button>
      <button class="nav-button" data-view="apiKeysView"><span aria-hidden="true">\u{1F511}</span> API Keys</button>
      <button class="nav-button" data-view="questionBankView"><span aria-hidden="true">\u{1F4E6}</span> Bank Soal</button>
    `;
  }
  els.mainNav.innerHTML = navHtml;
  const penulisGroup = els.mainNav.querySelector(".nav-group");
  const penulisSub = penulisGroup?.querySelector(".nav-sub");
  penulisGroup?.querySelector(".nav-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    const collapsed = penulisSub?.classList.contains("hidden") ?? true;
    penulisGroup.classList.toggle("open", collapsed);
    penulisSub?.classList.toggle("hidden", !collapsed);
    penulisGroup.querySelector(".nav-button")?.setAttribute("aria-expanded", String(collapsed));
  });
  els.mainNav.querySelectorAll("[data-nav-assessment-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setAssessmentTab(ctx, btn.dataset.navAssessmentTab);
      switchView(ctx, "assessmentListView");
    });
  });
  els.mainNav.querySelectorAll("[data-nav-view]").forEach((btn) => btn.addEventListener("click", () => switchView(ctx, btn.dataset.navView)));
  if (role === "student") {
    document.body.classList.add("student-mode");
    switchView(ctx, "studentView");
  } else if (role === "admin") {
    document.body.classList.add("admin-mode");
    switchView(ctx, "observabilityView");
  } else {
    document.body.classList.add("teacher-mode");
    switchView(ctx, "dashboardView");
  }
}
function setAssessmentTab(ctx, tab) {
  const { els } = ctx;
  if (!els.assessmentTabFilter) return;
  els.assessmentTabFilter.querySelectorAll(".tab-filter-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
}
function canAccessView(ctx, viewId) {
  if (!ctx.auth.user) return false;
  const role = ctx.auth.user.role;
  if (role === "student") return viewId === "studentView" || viewId === "studentHistoryView" || viewId === "studentNotifView";
  if (role === "admin") return viewId === "accountView" || viewId === "monitorView" || viewId === "observabilityView" || viewId === "apiKeysView" || viewId === "researchView" || viewId === "questionBankView";
  if (role === "teacher") return ["dashboardView", "teacherView", "assessmentListView", "assessmentDetailView", "monitorView", "manageClassView", "studentProfileView", "complaintView", "questionBankView", "notifView"].includes(viewId);
  return false;
}
async function switchView(ctx, viewId, { fromHistory = false } = {}) {
  if (!canAccessView(ctx, viewId)) return;
  const previousViewId = ctx.currentViewId;
  if (!fromHistory && previousViewId === viewId) return;
  if (!fromHistory) {
    const nextState = { ...history.state || {}, lisanView: viewId };
    const hash = `#${viewId}`;
    if (history.state?.lisanView) history.pushState(nextState, "", hash);
    else history.replaceState(nextState, "", hash);
  }
  ctx.currentViewId = viewId;
  const { els } = ctx;
  const navBtns = els.mainNav.querySelectorAll(".nav-button");
  navBtns.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  if (viewId === "dashboardView") {
    const { renderDashboard: renderDashboard2 } = await Promise.resolve().then(() => (init_dashboard(), dashboard_exports));
    renderDashboard2(ctx);
  }
  if (viewId === "assessmentListView") {
    const { renderAssessmentsWithTab: renderAssessmentsWithTab2 } = await Promise.resolve().then(() => (init_dashboard(), dashboard_exports));
    renderAssessmentsWithTab2(ctx);
  }
  if (viewId === "studentProfileView") {
    const { renderStudentProfile: renderStudentProfile2 } = await Promise.resolve().then(() => (init_dashboard(), dashboard_exports));
    populateProfileSelect(ctx);
    const names = [...new Set(ctx.state.submissions.map((s) => s.studentName))];
    if (names.length) {
      const selected = ctx.profileSelectedStudent && names.includes(ctx.profileSelectedStudent) ? ctx.profileSelectedStudent : names[0];
      elProfileSet(ctx, selected);
      renderStudentProfile2(ctx, selected);
    } else {
      els.studentProfileContent.innerHTML = '<div class="analytics-panel"><div class="empty-state">Belum ada siswa dengan penilaian. Data akan muncul setelah siswa mengumpulkan penilaian.</div></div>';
    }
  }
  if (viewId === "observabilityView") {
    const { loadTelemetry: loadTelemetry2 } = await Promise.resolve().then(() => (init_observability(), observability_exports));
    loadTelemetry2(ctx);
  }
  if (viewId === "researchView") {
    const { loadResearch: loadResearch2 } = await Promise.resolve().then(() => (init_research(), research_exports));
    loadResearch2(ctx);
  }
  if (viewId === "apiKeysView") {
    const { loadApiKeys: loadApiKeys2 } = await Promise.resolve().then(() => (init_api_keys(), api_keys_exports));
    loadApiKeys2(ctx);
  }
  if (viewId === "questionBankView") {
    const { loadQuestionBank: loadQuestionBank2 } = await Promise.resolve().then(() => (init_question_bank(), question_bank_exports));
    loadQuestionBank2(ctx);
  }
  if (viewId === "notifView") {
    const { clearNotificationBadge: clearNotificationBadge2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
    clearNotificationBadge2();
  }
}
function populateProfileSelect(ctx) {
  const { els } = ctx;
  if (!els.profileStudentSelect) return;
  const names = [...new Set(ctx.state.submissions.map((s) => s.studentName))].sort((a, b) => a.localeCompare(b));
  const options = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (els.profileStudentSelect.innerHTML !== options) els.profileStudentSelect.innerHTML = options;
}
function elProfileSet(ctx, name) {
  if (ctx.els.profileStudentSelect) ctx.els.profileStudentSelect.value = name;
}
async function refreshSimulatorIfEnabled(ctx) {
  const { els } = ctx;
  if (!els.simulatorWidget) return;
  try {
    const data = await getSimulationData();
    els.simulatorWidget.classList.remove("hidden");
    renderSimulator(ctx, data);
  } catch (error) {
    els.simulatorWidget.classList.add("hidden");
  }
}
async function refreshSimulator(ctx) {
  const { els } = ctx;
  try {
    const data = await getSimulationData();
    renderSimulator(ctx, data);
  } catch (error) {
    console.error("Gagal memuat data simulator:", error);
    if (els.simulatorTenantList) els.simulatorTenantList.innerHTML = `<div class="empty-state">Gagal memuat tenant: ${escapeHtml(error.message)}</div>`;
  }
}
function renderSimulator(ctx, data) {
  const { els, auth } = ctx;
  if (!els.simulatorTenantList) return;
  const { tenants, users: allUsers } = data;
  if (!tenants || !tenants.length) {
    els.simulatorTenantList.innerHTML = `<div class="empty-state">Belum ada tenant.</div>`;
    return;
  }
  const usersByTenant = {};
  allUsers.forEach((u) => {
    const tId = u.tenantId || u.tenant_id;
    if (!usersByTenant[tId]) usersByTenant[tId] = [];
    usersByTenant[tId].push(u);
  });
  els.simulatorTenantList.innerHTML = tenants.map((t) => {
    const tUsers = usersByTenant[t.id] || [];
    const userRows = tUsers.map((u) => {
      const isActive = auth && auth.authenticated && auth.user && auth.user.id === u.id;
      const roleClass = `simulator-role-${u.role}`;
      return `
        <div class="simulator-user-row ${isActive ? "active" : ""}">
          <div class="simulator-user-info">
            <span class="simulator-user-name">${escapeHtml(u.name)}</span>
            <span class="simulator-user-detail">${escapeHtml(u.email)}</span>
            <span class="simulator-user-role-badge ${roleClass}">${escapeHtml(roleLabel(u.role))}</span>
          </div>
          ${isActive ? `<span class="simulator-login-btn active" style="background: var(--emerald); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Aktif</span>` : `<button class="simulator-login-btn" data-user-id="${escapeHtml(u.id)}" type="button">Masuk</button>`}
        </div>
      `;
    }).join("");
    return `
      <div class="simulator-tenant-group">
        <div class="simulator-tenant-name">${escapeHtml(t.name)}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">${userRows.length ? userRows : '<p style="font-size: 0.75rem; color: var(--muted); margin: 0;">Tidak ada akun</p>'}</div>
      </div>
    `;
  }).join("");
}
var init_app_context = __esm({
  "src/js/app-context.js"() {
    init_dom();
    init_session();
    init_recorder();
    init_storage();
    init_api();
    init_render();
    init_toast();
    init_utils();
  }
});

// src/js/main.js
init_api();
init_app_context();

// src/js/auth-ui.js
init_api();
init_dom();
init_toast();
init_app_context();
function bindAuthEvents(ctx) {
  const { els } = ctx;
  document.addEventListener("keydown", (event) => handleModalKeyboard(ctx, event));
  if (els.openRegisterModalBtn) {
    els.openRegisterModalBtn.addEventListener("click", () => openRegisterModal(ctx));
  }
  if (els.closeRegisterModalBtn) {
    els.closeRegisterModalBtn.addEventListener("click", () => closeRegisterModal(ctx));
  }
  if (els.registerModal) {
    els.registerModal.addEventListener("click", (event) => {
      if (event.target === els.registerModal) {
        closeRegisterModal(ctx);
      }
    });
  }
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setButtonLoading(event.submitter, true, "Login...", "Login");
    try {
      const nextAuth = await login({
        email: els.loginEmail.value,
        password: els.loginPassword.value
      });
      await bootstrapAuthenticatedApp(ctx, nextAuth);
    } catch (error) {
      console.error("Login error:", error);
      showToast(error.message || "Login gagal");
    } finally {
      setButtonLoading(event.submitter, false, "Login...", "Login");
    }
  });
  els.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setButtonLoading(event.submitter, true, "Membuat tenant...", "Buat tenant");
    try {
      const nextAuth = await registerTenant({
        tenantName: els.registerTenant.value,
        name: els.registerName.value,
        email: els.registerEmail.value,
        password: els.registerPassword.value
      });
      closeRegisterModal(ctx);
      await bootstrapAuthenticatedApp(ctx, nextAuth);
    } catch (error) {
      showToast(error.message);
    } finally {
      setButtonLoading(event.submitter, false, "Membuat tenant...", "Buat tenant");
    }
  });
  if (els.registerPassword) {
    els.registerPassword.addEventListener("input", () => {
      const val = els.registerPassword.value;
      const bars = document.querySelectorAll("#registerPasswordStrength .password-strength-bar");
      const label = document.getElementById("registerPasswordStrengthLabel");
      if (!bars.length) return;
      let score = 0;
      if (val.length >= 8) score += 1;
      if (/[a-z]/.test(val) && /[A-Z]/.test(val)) score += 1;
      if (/\d/.test(val)) score += 1;
      if (/[^a-zA-Z0-9]/.test(val)) score += 1;
      const level = val.length === 0 ? -1 : score <= 1 ? 0 : score <= 2 ? 1 : 2;
      const levels = ["weak", "medium", "strong"];
      const labels = ["", "Lemah", "Sedang", "Kuat"];
      bars.forEach((bar, i) => {
        bar.className = "password-strength-bar" + (i <= level && level >= 0 ? " " + levels[level] : "");
      });
      if (label) {
        label.textContent = level >= 0 ? labels[level + 1] : "";
        label.className = "password-strength-label" + (level >= 0 ? " " + levels[level] : "");
      }
    });
  }
  els.logoutButton.addEventListener("click", async () => {
    await logout();
    ctx.auth = { authenticated: false };
    ctx.state = { assessments: [], submissions: [], classes: [], memberships: [] };
    ctx.users = [];
    ctx.session = null;
    clearAuthForms(ctx);
    showAuth(ctx);
    const { refreshSimulatorIfEnabled: refreshSimulatorIfEnabled2 } = await Promise.resolve().then(() => (init_app_context(), app_context_exports));
    refreshSimulatorIfEnabled2(ctx);
  });
}

// src/js/main.js
init_assessment_wizard();

// src/js/assessment-ux.js
function enhanceAssessmentWizardUX(ctx) {
  const form = ctx?.els?.form;
  if (!form || form.dataset.advancedSettingsEnhanced === "true") return;
  const fieldIds = ["difficulty", "timeLimit", "maxAttempts", "examples"];
  const controls = fieldIds.map((id) => document.getElementById(id)).filter((element) => element && form.contains(element));
  const checks = form.querySelector(".wizard-checks");
  const hasAdvancedContent = controls.length > 0 || !!checks;
  if (!hasAdvancedContent) return;
  const details = document.createElement("details");
  details.className = "advanced-settings";
  details.style.margin = "12px 0 16px";
  const summary = document.createElement("summary");
  summary.textContent = "\u2699\uFE0F Pengaturan lanjutan";
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "600";
  summary.style.padding = "10px 0";
  details.appendChild(summary);
  const hint = document.createElement("p");
  hint.textContent = "Opsional. Nilai default sudah cukup untuk mulai membuat penilaian.";
  hint.style.margin = "0 0 12px";
  hint.style.fontSize = "0.88rem";
  hint.style.opacity = "0.72";
  details.appendChild(hint);
  const panel = document.createElement("div");
  panel.className = "advanced-settings-panel";
  panel.style.display = "grid";
  panel.style.gap = "12px";
  details.appendChild(panel);
  const firstControl = controls[0] || checks.querySelector("input, select, textarea");
  const insertionPoint = firstControl?.closest(".form-row-2") || firstControl?.closest("label") || checks || firstControl;
  if (!insertionPoint?.parentNode) return;
  insertionPoint.parentNode.insertBefore(details, insertionPoint);
  controls.forEach((control) => {
    const label = control.closest("label");
    if (label) panel.appendChild(label);
  });
  if (checks && !details.contains(checks)) panel.appendChild(checks);
  form.querySelectorAll(".form-row-2").forEach((row) => {
    if (!row.querySelector("input, select, textarea, button")) row.remove();
  });
  const primaryButton = form.querySelector("#wizardToQuestions") || form.querySelector("button[type='submit']");
  if (primaryButton) primaryButton.setAttribute("data-primary-action", "true");
  form.dataset.advancedSettingsEnhanced = "true";
}

// src/js/student-flow.js
init_api();
init_assessment_factory();
init_dom();
init_fallback_assessment();

// src/js/mic-check.js
init_recorder();
var SAMPLE_SECONDS = 4;
var HEARD_THRESHOLD = 0.03;
function createMicCheck({ volumeIndicator, playback }) {
  let stream = null;
  let audioContext = null;
  let analyser = null;
  let meterRaf = null;
  let peakLevel = 0;
  let playbackUrl = null;
  let running = false;
  async function run(onTick) {
    if (running) return { ok: false, message: "Tes mikrofon sedang berjalan." };
    running = true;
    reset();
    try {
      if (!window.isSecureContext) {
        return { ok: false, message: "Mikrofon hanya bisa dipakai di HTTPS atau localhost." };
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        return { ok: false, message: "Browser tidak mendukung akses mikrofon. Jawaban bisa diketik manual." };
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
      } catch (error) {
        return { ok: false, message: getMicrophoneErrorMessage(error), name: error?.name || "" };
      }
      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        return { ok: false, message: "Mikrofon terdeteksi tetapi tidak ada track audio aktif." };
      }
      const label = tracks[0].label || "Mikrofon bawaan";
      startMeter();
      const chunks = await recordSample(onTick);
      stopMeter();
      releaseStream();
      if (chunks.length) setPlayback(chunks);
      return {
        ok: true,
        label,
        heard: peakLevel >= HEARD_THRESHOLD,
        peak: peakLevel,
        hasPlayback: chunks.length > 0,
        message: `Mikrofon aktif: ${label}`
      };
    } finally {
      stopMeter();
      releaseStream();
      running = false;
    }
  }
  function recordSample(onTick) {
    return new Promise((resolve) => {
      let recorder = null;
      const chunks = [];
      const countdown = (secondsLeft) => {
        if (typeof onTick === "function") onTick(secondsLeft);
        if (secondsLeft > 0) {
          setTimeout(() => countdown(secondsLeft - 1), 1e3);
          return;
        }
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        } else {
          resolve(chunks);
        }
      };
      if (typeof window.MediaRecorder !== "function") {
        countdown(SAMPLE_SECONDS);
        return;
      }
      try {
        recorder = new MediaRecorder(stream);
      } catch (error) {
        console.warn("MediaRecorder tidak tersedia untuk tes mikrofon:", error?.message);
        countdown(SAMPLE_SECONDS);
        return;
      }
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = () => resolve(chunks);
      recorder.onerror = () => resolve(chunks);
      recorder.start();
      countdown(SAMPLE_SECONDS);
    });
  }
  function setPlayback(chunks) {
    if (!playback) return;
    revokePlayback();
    playbackUrl = URL.createObjectURL(new Blob(chunks, { type: "audio/webm" }));
    playback.src = playbackUrl;
    playback.classList.remove("hidden");
  }
  function startMeter() {
    stopMeter();
    peakLevel = 0;
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const bars = volumeIndicator ? [...volumeIndicator.querySelectorAll(".volume-bar")] : [];
      const tick = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const deviation = (samples[i] - 128) / 128;
          sumSquares += deviation * deviation;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        peakLevel = Math.max(peakLevel, rms);
        const activeBars = Math.round(Math.min(1, rms * 6) * bars.length);
        bars.forEach((bar, index) => bar.classList.toggle("active", index < activeBars));
        meterRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch (error) {
      console.warn("Level meter tes mikrofon tidak tersedia:", error?.message);
    }
  }
  function stopMeter() {
    if (meterRaf) {
      cancelAnimationFrame(meterRaf);
      meterRaf = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {
      });
      audioContext = null;
    }
    analyser = null;
    clearBars();
  }
  function clearBars() {
    volumeIndicator?.querySelectorAll(".volume-bar").forEach((bar) => bar.classList.remove("active"));
  }
  function releaseStream() {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  function revokePlayback() {
    if (!playbackUrl) return;
    URL.revokeObjectURL(playbackUrl);
    playbackUrl = null;
  }
  function reset() {
    stopMeter();
    releaseStream();
    if (playback) {
      playback.pause?.();
      playback.removeAttribute("src");
      playback.classList.add("hidden");
    }
    revokePlayback();
  }
  return { run, reset, isRunning: () => running, sampleSeconds: SAMPLE_SECONDS };
}

// src/js/student-flow.js
init_render();
init_toast();
init_utils();
init_app_context();
function bindStudentFlowEvents(ctx) {
  const { els } = ctx;
  ctx.micCheck = createMicCheck({
    volumeIndicator: els.preExamVolume,
    playback: els.preExamPlayback
  });
  if (els.studentAssessmentGrid) {
    els.studentAssessmentGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".start-assessment-btn") || e.target.closest(".assessment-card");
      if (!btn) return;
      const assessment = ctx.state.assessments.find((item) => item.id === btn.dataset.id);
      if (!assessment) return;
      if (isAssessmentLocked(ctx, assessment)) {
        if (assessment.status === "closed") {
          showToast("Akses ke penilaian ini sedang ditutup oleh guru.");
        } else {
          showToast("Penilaian ini sudah dikumpulkan dan tidak bisa dibuka lagi.");
        }
        return;
      }
      openPreExamModal(ctx, assessment, btn);
    });
  }
  bindPreExamEvents(ctx);
  if (els.backToDashboard) {
    els.backToDashboard.addEventListener("click", async () => {
      ctx.recorder.stop();
      stopQuestionTimer(ctx);
      resetProbingState(ctx);
      ctx.session.currentAssessmentId = null;
      await renderCurrentState2(ctx);
    });
  }
  els.saveAnswer.addEventListener("click", async () => {
    ctx.recorder.stop();
    await saveCurrentAnswer(ctx);
    const assessment = ctx.session.getCurrentAssessment();
    const qi = ctx.session.currentQuestionIndex;
    const q = assessment?.questions?.[qi];
    if (ctx.inProbing) {
      ctx.inProbing = false;
      ctx.probingPrompt = null;
      advanceAfterAnswer(ctx);
      return;
    }
    if (q?.probing && !ctx.session.currentAnswers[qi]?.probing?.done) {
      await startProbingForCurrentQuestion(ctx);
      return;
    }
    advanceAfterAnswer(ctx);
  });
  els.finishAssessment.addEventListener("click", (e) => {
    stopQuestionTimer(ctx);
    confirmAndFinishAssessment(ctx);
  });
  if (els.testMicButton) {
    els.testMicButton.addEventListener("click", async () => {
      const result = await ctx.recorder.testMicrophone();
      renderMicDiagnostics(ctx, result);
    });
  }
}
function bindPreExamEvents(ctx) {
  const { els } = ctx;
  if (!els.preExamModal) return;
  els.preExamMicTest?.addEventListener("click", () => runPreExamMicTest(ctx));
  els.preExamStart?.addEventListener("click", () => startExamFromModal(ctx));
  els.preExamCancel?.addEventListener("click", () => closePreExamModal(ctx));
  els.preExamClose?.addEventListener("click", () => closePreExamModal(ctx));
  els.preExamModal.addEventListener("click", (event) => {
    if (event.target === els.preExamModal) closePreExamModal(ctx);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || els.preExamModal.classList.contains("hidden")) return;
    event.preventDefault();
    closePreExamModal(ctx);
  });
}
function openPreExamModal(ctx, assessment, trigger = null) {
  const { els } = ctx;
  ctx.pendingExamAssessmentId = assessment.id;
  if (!els.preExamModal) {
    startExam(ctx, assessment.id);
    return;
  }
  ctx.preExamTrigger = trigger;
  ctx.micCheck?.reset();
  if (els.preExamTitle) els.preExamTitle.textContent = assessment.topic || "Penilaian";
  if (els.preExamMeta) els.preExamMeta.innerHTML = buildPreExamMeta(ctx, assessment);
  resetPreExamMicUi(ctx);
  const isOralExam = assessment.oralExamEnabled !== false;
  els.preExamMicSection?.classList.toggle("hidden", !isOralExam);
  if (els.preExamStart) {
    els.preExamStart.textContent = "Mulai ujian sekarang";
    els.preExamStart.disabled = isOralExam;
  }
  setPreExamNote(
    ctx,
    isOralExam ? "Tes mikrofon dulu agar jawaban lisan Anda terekam. Timer belum berjalan." : "Penilaian ini tidak memerlukan mikrofon. Timer mulai setelah Anda menekan tombol mulai.",
    false
  );
  els.preExamModal.classList.remove("hidden");
  (isOralExam ? els.preExamMicTest : els.preExamStart)?.focus();
}
function closePreExamModal(ctx, { returnFocus = true } = {}) {
  const { els } = ctx;
  if (!els.preExamModal) return;
  els.preExamModal.classList.add("hidden");
  ctx.micCheck?.reset();
  ctx.pendingExamAssessmentId = null;
  if (returnFocus && ctx.preExamTrigger instanceof HTMLElement && document.contains(ctx.preExamTrigger)) {
    ctx.preExamTrigger.focus();
  }
  ctx.preExamTrigger = null;
}
function buildPreExamMeta(ctx, assessment) {
  const total = assessment.questions?.length || 0;
  const timeLimit = Number(assessment.timeLimit) || 0;
  const used = ctx.state.submissions.filter((submission) => submission.assessmentId === assessment.id).length;
  const maxAttempts = assessment.allowRetakes ? Infinity : Number(assessment.maxAttempts) || 1;
  const attempts = Number.isFinite(maxAttempts) ? `${Math.max(0, maxAttempts - used)} percobaan tersisa` : "Percobaan tak terbatas";
  return `
    <div class="pre-exam-topic">
      <strong>Topik:</strong> ${escapeHtml(assessment.topic || "-")}
    </div>
    ${assessment.outcomes ? `<div class="pre-exam-outcome"><strong>Kompetensi:</strong> ${escapeHtml(assessment.outcomes)}</div>` : ""}
    <div class="pre-exam-stats">
      ${[
    `\u{1F4DD} ${total} soal`,
    timeLimit > 0 ? `\u23F1 ${formatDuration(timeLimit)} / soal` : "\u23F1 Tanpa batas waktu",
    `\u{1F504} ${attempts}`,
    `\u{1F39A} ${assessment.difficulty || "-"}`
  ].map((text) => `<span>${escapeHtml(text)}</span>`).join("")}
    </div>
  `;
}
function resetPreExamMicUi(ctx) {
  const { els } = ctx;
  if (els.preExamMicTest) {
    els.preExamMicTest.disabled = false;
    els.preExamMicTest.textContent = "Tes mikrofon";
  }
  setPreExamMicStatus(ctx, "Mikrofon belum dites", "");
  if (els.preExamMicDiagnostics) {
    els.preExamMicDiagnostics.innerHTML = "";
    els.preExamMicDiagnostics.classList.add("hidden");
  }
}
function setPreExamMicStatus(ctx, text, variant) {
  const { els } = ctx;
  if (!els.preExamMicStatus) return;
  els.preExamMicStatus.textContent = text;
  els.preExamMicStatus.className = `mic-status${variant ? ` ${variant}` : ""}`;
}
function setPreExamNote(ctx, text, warn) {
  const { els } = ctx;
  if (!els.preExamStartNote) return;
  els.preExamStartNote.textContent = text;
  els.preExamStartNote.className = `pre-exam-note${warn ? " warn" : ""}`;
}
async function runPreExamMicTest(ctx) {
  const { els } = ctx;
  if (!ctx.micCheck || ctx.micCheck.isRunning()) return;
  if (els.preExamMicTest) els.preExamMicTest.disabled = true;
  if (els.preExamStart) els.preExamStart.disabled = true;
  if (els.preExamMicDiagnostics) els.preExamMicDiagnostics.classList.add("hidden");
  setPreExamMicStatus(ctx, "Menyiapkan mikrofon...", "");
  setPreExamNote(ctx, "Bicara dengan suara normal selama beberapa detik.", false);
  const result = await ctx.micCheck.run((secondsLeft) => {
    if (secondsLeft > 0) setPreExamMicStatus(ctx, `Bicara sekarang... ${secondsLeft}s`, "");
  });
  if (els.preExamMicTest) {
    els.preExamMicTest.disabled = false;
    els.preExamMicTest.textContent = "Tes ulang mikrofon";
  }
  if (els.preExamStart) els.preExamStart.disabled = false;
  renderPreExamMicResult(ctx, result);
}
function renderPreExamMicResult(ctx, result) {
  const { els } = ctx;
  const box = els.preExamMicDiagnostics;
  if (!result.ok) {
    setPreExamMicStatus(ctx, "\u2715 Mikrofon bermasalah", "error");
    if (box) {
      box.classList.remove("hidden", "ok");
      box.classList.add("error");
      box.innerHTML = `
        <strong>Mikrofon belum bisa dipakai.</strong>
        <p>${escapeHtml(result.message)}</p>
        ${buildMicHelp(result.name)}
      `;
    }
    if (els.preExamStart) els.preExamStart.textContent = "Mulai tanpa mikrofon";
    setPreExamNote(ctx, "Mikrofon gagal. Anda tetap bisa mulai dan mengetik jawaban di kolom transkripsi.", true);
    return;
  }
  if (!result.heard) {
    setPreExamMicStatus(ctx, "\u26A0 Suara tidak terdengar", "error");
    if (box) {
      box.classList.remove("hidden", "ok");
      box.classList.add("error");
      box.innerHTML = `
        <strong>Mikrofon terbaca, tetapi tidak ada suara masuk.</strong>
        <p>${escapeHtml(result.message)}</p>
        <ul>
          <li>Pastikan mikrofon tidak dalam kondisi mute (hardware maupun sistem).</li>
          <li>Pilih perangkat input yang benar di pengaturan suara.</li>
          <li>Dekatkan mikrofon lalu klik <b>Tes ulang mikrofon</b>.</li>
        </ul>
      `;
    }
    setPreExamNote(ctx, "Sebaiknya tes ulang dulu sebelum mulai agar jawaban lisan Anda terekam.", true);
    return;
  }
  setPreExamMicStatus(ctx, "\u2713 Mikrofon siap", "ok");
  if (box) {
    box.classList.remove("hidden", "error");
    box.classList.add("ok");
    box.innerHTML = `
      <strong>Mikrofon siap digunakan.</strong>
      <p>${escapeHtml(result.message)}</p>
      ${result.hasPlayback ? "<p>Putar rekaman di atas untuk memastikan suara Anda jelas.</p>" : ""}
    `;
  }
  setPreExamNote(ctx, "Mikrofon siap. Timer akan mulai begitu Anda menekan tombol mulai.", false);
}
async function startExamFromModal(ctx) {
  const assessmentId = ctx.pendingExamAssessmentId;
  if (!assessmentId || ctx.isStartingExam) return;
  ctx.isStartingExam = true;
  if (ctx.els.preExamStart) ctx.els.preExamStart.disabled = true;
  try {
    closePreExamModal(ctx, { returnFocus: false });
    await startExam(ctx, assessmentId);
  } finally {
    ctx.isStartingExam = false;
  }
}
async function startExam(ctx, assessmentId) {
  const { els } = ctx;
  ctx.recorder.stop();
  ctx.session.selectAssessment(assessmentId);
  resetProbingState(ctx);
  els.resultPanel.classList.add("hidden");
  await renderCurrentState2(ctx);
  await startRecorderForCurrentAssessment(ctx);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();
  window.addEventListener("beforeunload", beforeUnloadHandler);
}
function resetProbingState(ctx) {
  ctx.inProbing = false;
  ctx.probingPrompt = null;
}
function advanceAfterAnswer(ctx) {
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  const qi = ctx.session.currentQuestionIndex;
  const isLast = assessment && qi === assessment.questions.length - 1;
  if (isLast) {
    stopQuestionTimer(ctx);
    confirmAndFinishAssessment(ctx);
    return;
  }
  ctx.session.goNext();
  renderQuestion(els, assessment, ctx.session);
  startRecorderForCurrentAssessment(ctx);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();
}
async function startProbingForCurrentQuestion(ctx) {
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  const qi = ctx.session.currentQuestionIndex;
  const q = assessment?.questions?.[qi];
  if (!q) return;
  const answer = ctx.session.currentAnswers[qi]?.text || "";
  ctx.inProbing = true;
  ctx.probingPrompt = null;
  ctx.probingRaw = "";
  if (els.questionProgress) {
    els.questionProgress.textContent = `Soal ${qi + 1} dari ${assessment.questions.length} \u2014 pertanyaan lanjutan`;
  }
  if (els.activeHint) {
    els.activeHint.textContent = "AI menyiapkan pertanyaan lanjutan berdasarkan jawaban Anda...";
    els.activeHint.classList.remove("hidden");
  }
  if (els.recordButton) els.recordButton.disabled = true;
  if (els.answerText) {
    els.answerText.readOnly = true;
    els.answerText.value = "";
  }
  setButtonLoading(els.saveAnswer, true, "Menyiapkan pertanyaan lanjutan...", "Simpan & lanjut");
  let probing;
  try {
    probing = await generateProbingForAnswer(ctx, assessment, q, answer);
  } catch (error) {
    ctx.inProbing = false;
    showToast("Gagal membuat pertanyaan lanjutan, lanjut ke soal berikutnya.", "error");
    ctx.session.currentAnswers[qi].probing = { done: true };
    setButtonLoading(els.saveAnswer, false, "", "Simpan & lanjut");
    advanceAfterAnswer(ctx);
    return;
  } finally {
    setButtonLoading(els.saveAnswer, false, "", "Simpan & lanjut");
  }
  ctx.probingPrompt = probing.prompt;
  ctx.session.currentAnswers[qi].probing = {
    prompt: probing.prompt,
    answer: "",
    audio: null,
    duration: 0,
    done: false
  };
  renderProbing(ctx, probing);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();
}
async function generateProbingForAnswer(ctx, assessment, question, answer) {
  const payload = {
    prompt: question.prompt,
    focus: question.focus || assessment.topic,
    outcomes: question.outcome || assessment.outcomes,
    answer
  };
  const fallback = () => generateProbingFallback({
    prompt: question.prompt,
    answer,
    focus: question.focus || assessment.topic,
    topic: assessment.topic
  });
  let probing = null;
  try {
    probing = await withTimeout(
      new Promise((resolve, reject) => {
        streamAssessmentAction({
          action: "generate-probing",
          payload,
          // Streaming kata-per-kata: tampilkan prompt lanjutan begitu token
          // JSON-nya mengalir dari server, agar siswa melihat pertanyaan
          // lanjutan "terlahir" secara live (dengan animasi).
          onChunk: (text) => {
            renderProbingStream(ctx, text);
          },
          onResult: (data) => resolve(data?.probing || null),
          onError: (message) => reject(new Error(message))
        }).catch(reject);
      }),
      PROBING_TIMEOUT_MS
    );
  } catch {
    probing = null;
  }
  if (probing && String(probing.prompt || "").trim()) return probing;
  return fallback();
}
function renderProbingStream(ctx, chunk) {
  const { els } = ctx;
  ctx.probingRaw = (ctx.probingRaw || "") + chunk;
  const prompt2 = extractStreamedField2(ctx.probingRaw, "prompt");
  if (prompt2 === null) return;
  if (els.activeQuestion) {
    const badge = `<span class="probing-badge" role="status">\u26A1 Pertanyaan lanjutan</span>`;
    els.activeQuestion.innerHTML = `${badge}<span class="probing-text">${escapeHtml(prompt2)}</span>`;
    els.activeQuestion.classList.add("probing-active", "probing-live");
  }
}
function extractStreamedField2(raw, field) {
  const keyPattern = `"${field}"`;
  const keyIdx = raw.indexOf(keyPattern);
  if (keyIdx === -1) return null;
  let i = keyIdx + keyPattern.length;
  while (i < raw.length && (raw[i] === " " || raw[i] === ":")) i += 1;
  if (raw[i] !== '"') return null;
  i += 1;
  let out = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === void 0) break;
      if (next === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (next === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (next === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i += 1;
  }
  return out;
}
var PROBING_TIMEOUT_MS = 15e3;
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function renderProbing(ctx, probing) {
  const { els } = ctx;
  const prompt2 = String(probing?.prompt || "").trim() || "Pertanyaan lanjutan.";
  ctx.probingRaw = "";
  if (els.activeQuestion) {
    els.activeQuestion.innerHTML = `
      <span class="probing-badge" role="status">\u26A1 Pertanyaan lanjutan</span>
      <span class="probing-text">${escapeHtml(prompt2)}</span>
    `;
    els.activeQuestion.classList.remove("probing-live");
    els.activeQuestion.classList.add("probing-active");
  }
  if (els.activeHint) {
    els.activeHint.textContent = "Jawab pertanyaan lanjutan ini. Timer berjalan seperti soal sebelumnya.";
    els.activeHint.classList.remove("hidden");
  }
  if (els.recordButton) els.recordButton.disabled = false;
  if (els.answerText) {
    els.answerText.readOnly = false;
    els.answerText.value = "";
  }
  if (els.saveAnswer) els.saveAnswer.textContent = "Simpan & lanjut";
}
function beforeUnloadHandler(e) {
  e.preventDefault();
  e.returnValue = "";
}
function clearBeforeUnload() {
  window.removeEventListener("beforeunload", beforeUnloadHandler);
}
async function saveCurrentAnswer(ctx) {
  var _a;
  const audio = await ctx.recorder.getAudioBase64();
  const elapsed = Math.round((Date.now() - ctx.questionStartTime) / 1e3);
  if (ctx.inProbing) {
    const qi = ctx.session.currentQuestionIndex;
    const probing = (_a = ctx.session.currentAnswers[qi]).probing || (_a.probing = { done: false });
    probing.answer = (ctx.els.answerText.value || "").trim();
    if (audio) probing.audio = audio;
    probing.duration = (probing.duration || 0) + elapsed;
    probing.done = true;
  } else {
    ctx.session.saveAnswer(ctx.els.answerText.value, audio, elapsed);
  }
  ctx.recorder.clearAudio();
  ctx.questionStartTime = Date.now();
}
async function startRecorderForCurrentAssessment(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  const isOralExam = assessment?.oralExamEnabled !== false;
  ctx.recorder.setEnabled(isOralExam);
  if (!isOralExam) return;
  ctx.recorder.resetStatus();
  try {
    await ctx.recorder.start();
  } catch (err) {
    console.warn("Could not start recorder:", err);
  }
}
function getUnansweredCount(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return 0;
  return assessment.questions.reduce((count, _, index) => {
    const answer = ctx.session.currentAnswers[index];
    const hasText = (answer?.text || "").trim().length > 0;
    const hasAudio = Boolean(answer?.audio);
    return hasText || hasAudio ? count : count + 1;
  }, 0);
}
function renderMicDiagnostics(ctx, result) {
  const { els } = ctx;
  if (!els.micStatus || !els.micDiagnostics) return;
  els.micDiagnostics.classList.remove("hidden");
  els.micDiagnostics.classList.toggle("ok", result.ok);
  els.micDiagnostics.classList.toggle("error", !result.ok);
  if (result.ok) {
    els.micStatus.textContent = "\u2713 Mikrofon siap";
    els.micStatus.className = "mic-status ok";
    els.micDiagnostics.innerHTML = `
      <strong>Mikrofon siap digunakan.</strong>
      <p>${escapeHtml(result.message)}</p>
    `;
    return;
  }
  els.micStatus.textContent = "\u2715 Mikrofon bermasalah";
  els.micStatus.className = "mic-status error";
  els.micDiagnostics.innerHTML = `
    <strong>Mikrofon belum bisa dipakai.</strong>
    <p>${escapeHtml(result.message)}</p>
    ${buildMicHelp(result.name)}
    <p style="margin-top: 8px;"><b>Alternatif:</b> Anda tetap bisa menjawab dengan mengetik jawaban di kolom transkripsi di bawah, lalu klik <b>Simpan & lanjut</b>.</p>
  `;
}
function buildMicHelp(errorName) {
  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return `
      <ul>
        <li>Klik ikon gembok \u{1F512} di address bar browser.</li>
        <li>Ubah izin mikrofon menjadi <b>Allow</b> / <b>Izinkan</b>.</li>
        <li>Muat ulang halaman (F5) lalu coba lagi.</li>
      </ul>
    `;
  }
  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return `
      <ul>
        <li>Pastikan mikrofon tersambung dan tidak dimatikan.</li>
        <li>Pilih perangkat input yang benar di pengaturan suara sistem.</li>
        <li>Di browser, buka <b>Settings &gt; Privacy &gt; Microphone</b> dan pilih perangkat.</li>
      </ul>
    `;
  }
  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return `
      <ul>
        <li>Mikrofon mungkin sedang dipakai aplikasi lain (Zoom, Meet, dsb).</li>
        <li>Tutup aplikasi lain yang memakai mikrofon, lalu coba lagi.</li>
      </ul>
    `;
  }
  return `
    <ul>
      <li>Pastikan halaman dibuka di HTTPS atau localhost.</li>
      <li>Gunakan browser terbaru (Chrome/Edge) dan izinkan akses mikrofon.</li>
    </ul>
  `;
}
async function confirmAndFinishAssessment(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;
  const unanswered = getUnansweredCount(ctx);
  const total = assessment.questions.length;
  await saveCurrentAnswer(ctx);
  const unansweredAfterSave = getUnansweredCount(ctx);
  let message;
  if (unansweredAfterSave > 0) {
    message = unansweredAfterSave === total ? "Belum ada satu pun soal yang dijawab. Anda akan mengumpulkan penilaian tanpa jawaban." : `${unansweredAfterSave} dari ${total} soal belum dijawab. Soal kosong akan dinilai 0.`;
  } else {
    message = `Semua ${total} soal sudah dijawab. Yakin ingin menyelesaikan dan mengumpulkan penilaian?`;
  }
  const proceed = await showConfirmDialog(message, "Selesaikan Penilaian");
  if (!proceed) return;
  handleFinishAssessment(ctx);
}
async function handleFinishAssessment(ctx) {
  const { els } = ctx;
  if (ctx.isEvaluating) return;
  clearBeforeUnload();
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;
  ctx.isEvaluating = true;
  els.evaluationLoadingModal?.classList.remove("hidden");
  if (els.evaluationStreamContent) els.evaluationStreamContent.textContent = "";
  renderEvaluationPreview(els, assessment, ctx.session.currentAnswers);
  updateEvaluationProgress(els, "Menyiapkan evaluasi...");
  setButtonLoading(els.finishAssessment, true, "Menilai dengan AI...", "Selesaikan penilaian");
  try {
    await saveCurrentAnswer(ctx);
    const studentName = ctx.auth.user.role === "student" ? ctx.auth.user.name : els.studentName.value.trim() || "Siswa tanpa nama";
    const submission = await evaluateWithFallback(ctx, assessment, studentName);
    if (!assessment.isTryout) {
      await saveSubmissionToDatabase(submission);
      ctx.state.submissions.push(submission);
    } else {
      submission.isTryout = true;
      showToast("Hasil tryout ditampilkan di sini (tidak disimpan ke database)", "info");
    }
    renderMonitoring(els, ctx.state);
    renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
    showResult(els, submission, ctx.auth);
    if (ctx.auth.user.role === "student") {
      ctx.session.currentAssessmentId = null;
      await renderCurrentState2(ctx);
    }
  } catch (error) {
    showToast(`Gagal menyimpan hasil: ${error.message}`);
  } finally {
    ctx.isEvaluating = false;
    els.evaluationLoadingModal?.classList.add("hidden");
    setButtonLoading(els.finishAssessment, false, "Menilai dengan AI...", "Selesaikan penilaian");
  }
}
async function evaluateWithFallback(ctx, assessment, studentName) {
  const answers = ctx.session.currentAnswers;
  try {
    const textAnswers = answers.map((a) => combineAnswerWithProbing(a).text);
    const safeAssessment = sanitizeAssessmentForEvaluation(assessment);
    const data = await streamAssessmentAction({
      action: "evaluate",
      payload: { assessment: safeAssessment, answers: textAnswers, studentName },
      onChunk: (text) => {
        updateEvaluationProgress(ctx.els, text);
      }
    });
    const questionScoresWithMetadata = data.evaluation.questionScores.map((qs, idx) => ({
      ...qs,
      audio: answers[idx]?.audio || null,
      duration: answers[idx]?.duration || 0,
      probing: answers[idx]?.probing || null
    }));
    const evaluation = data.evaluation;
    return createSubmission({
      assessment,
      studentName,
      finalScore: evaluation.finalScore,
      questionScores: questionScoresWithMetadata,
      feedback: evaluation.feedback,
      status: evaluation.requiresHumanReview ? "NEEDS_REVIEW" : "EVALUATED",
      verification: evaluation.verification || null,
      criteria: evaluation.criteria || [],
      evaluationRunId: evaluation.evaluationRunId || null,
      evaluationId: evaluation.evaluationId || null,
      evaluationSource: "harness",
      insight: buildHarnessInsight(evaluation)
    });
  } catch (error) {
    showToast("AI sedang tidak dapat diakses, penilaian memakai evaluasi lokal yang tetap valid.", "info");
    const combinedAnswers = answers.map((a) => combineAnswerWithProbing(a));
    const fallback = evaluateFallbackAssessment(assessment, combinedAnswers, studentName, createSubmission);
    return {
      ...fallback,
      evaluationSource: "fallback",
      verification: null,
      criteria: []
    };
  }
}
function combineAnswerWithProbing(answerObj) {
  const base = String(answerObj?.text || "").trim();
  const probing = answerObj?.probing;
  const hasProbing = probing && probing.done && String(probing.answer || "").trim().length > 0;
  if (!hasProbing) return { ...answerObj, text: base };
  const probingText = String(probing.answer).trim();
  const combined = base ? `${base}

[Jawaban pertanyaan lanjutan]
${probingText}` : probingText;
  return { ...answerObj, text: combined };
}
function buildHarnessInsight(evaluation) {
  const criteria = Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
  if (!criteria.length) return "";
  const weakest = criteria.filter((c) => Number.isFinite(Number(c.score))).sort((a, b) => Number(a.score) - Number(b.score))[0];
  const strongest = criteria.filter((c) => Number.isFinite(Number(c.score))).sort((a, b) => Number(b.score) - Number(a.score))[0];
  const parts = [];
  if (strongest) parts.push(`Kekuatan utama pada ${strongest.name || prettifyId(strongest.criterionId) || "kriteria terkuat"}.`);
  if (weakest) parts.push(`Area yang perlu diperkuat: ${weakest.name || prettifyId(weakest.criterionId) || "kriteria terlemah"}.`);
  return parts.join(" ").trim();
}
function sanitizeAssessmentForEvaluation(assessment) {
  if (!assessment || !Array.isArray(assessment.questions)) return assessment;
  return {
    ...assessment,
    questions: assessment.questions.map((question) => ({
      prompt: question?.prompt || "",
      focus: question?.focus || "",
      // Pertahankan rubrik & pemetaan kriteria PER SOAL. Criteria penilaian
      // harus diambil dari rubrik per soal, bukan dari rubrik topik yang
      // digabung — ini yang membuat evaluasi konsisten dengan substansi soal.
      rubric: question?.rubric || "",
      criteria: Array.isArray(question?.criteria) ? question.criteria : []
    }))
  };
}
function stopQuestionTimer(ctx) {
  const { els } = ctx;
  if (ctx.questionTimerInterval) {
    clearInterval(ctx.questionTimerInterval);
    ctx.questionTimerInterval = null;
  }
  if (els.timerDisplay) els.timerDisplay.style.animation = "none";
}
function startQuestionTimer(ctx) {
  stopQuestionTimer(ctx);
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment || !assessment.timeLimit || assessment.timeLimit <= 0) {
    if (els.timerDisplay) els.timerDisplay.style.display = "none";
    if (els.recordButton) els.recordButton.disabled = false;
    if (els.answerText) els.answerText.disabled = false;
    return;
  }
  const qi = ctx.session.currentQuestionIndex;
  const target = ctx.inProbing ? ctx.session.currentAnswers[qi]?.probing : ctx.session.currentAnswers[qi];
  if (!target) return;
  if (target.timeLeft === void 0) {
    target.timeLeft = assessment.timeLimit;
  }
  ctx.currentQuestionTimeLeft = target.timeLeft;
  if (ctx.currentQuestionTimeLeft <= 0) {
    if (els.timerDisplay) {
      els.timerDisplay.style.display = "inline-flex";
      els.timerDisplay.style.color = "var(--rose)";
      els.timerDisplay.style.borderColor = "var(--rose)";
      els.timerDisplay.innerHTML = `<strong>Waktu Habis</strong>`;
    }
    if (els.recordButton) els.recordButton.disabled = true;
    if (els.answerText) els.answerText.disabled = true;
    ctx.recorder.stop();
    return;
  }
  if (els.timerDisplay) {
    els.timerDisplay.style.display = "inline-flex";
    els.timerDisplay.style.color = "var(--rose)";
    els.timerDisplay.style.borderColor = "var(--rose)";
    els.timerDisplay.innerHTML = `<strong>${formatTime(ctx.currentQuestionTimeLeft)}</strong> tersisa`;
  }
  if (els.recordButton) els.recordButton.disabled = false;
  if (els.answerText) els.answerText.disabled = false;
  ctx.questionTimerInterval = setInterval(() => {
    ctx.currentQuestionTimeLeft--;
    target.timeLeft = ctx.currentQuestionTimeLeft;
    if (ctx.currentQuestionTimeLeft <= 0) {
      stopQuestionTimer(ctx);
      handleTimeOut(ctx);
    } else {
      if (els.timerDisplay) {
        els.timerDisplay.innerHTML = `<strong>${formatTime(ctx.currentQuestionTimeLeft)}</strong> tersisa`;
        if (ctx.currentQuestionTimeLeft <= 10) {
          els.timerDisplay.style.animation = "pulseRed 1s infinite";
        }
      }
    }
  }, 1e3);
}
async function handleTimeOut(ctx) {
  const { els } = ctx;
  if (els.timerDisplay) els.timerDisplay.innerHTML = `<strong>Waktu Habis</strong>`;
  ctx.recorder.stop();
  if (els.recordButton) els.recordButton.disabled = true;
  if (els.answerText) els.answerText.disabled = true;
  showToast("Waktu habis! Jawaban disimpan secara otomatis.", "error");
  await new Promise((resolve) => setTimeout(resolve, 200));
  await saveCurrentAnswer(ctx);
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;
  const qi = ctx.session.currentQuestionIndex;
  const q = assessment.questions[qi];
  if (ctx.inProbing) {
    ctx.inProbing = false;
    ctx.probingPrompt = null;
    advanceAfterAnswer(ctx);
    return;
  }
  if (q?.probing && !ctx.session.currentAnswers[qi]?.probing?.done) {
    await startProbingForCurrentQuestion(ctx);
    return;
  }
  const isLastQuestion = qi === assessment.questions.length - 1;
  if (isLastQuestion) {
    await handleFinishAssessment(ctx);
  } else {
    ctx.session.goNext();
    renderQuestion(els, assessment, ctx.session);
    await startRecorderForCurrentAssessment(ctx);
    startQuestionTimer(ctx);
    ctx.questionStartTime = Date.now();
  }
}

// src/js/main.js
init_class_management();
init_user_management();

// src/js/simulator.js
init_api();
init_toast();
init_app_context();
function bindSimulatorEvents(ctx) {
  const { els } = ctx;
  if (els.simulatorToggle) {
    els.simulatorToggle.addEventListener("click", () => {
      const isHidden = els.simulatorPanel.classList.toggle("hidden");
      els.simulatorToggle.setAttribute("aria-expanded", !isHidden);
      if (!isHidden) {
        refreshSimulatorIfEnabled(ctx);
      }
    });
  }
  if (els.simulatorClose) {
    els.simulatorClose.addEventListener("click", () => {
      els.simulatorPanel.classList.add("hidden");
      els.simulatorToggle.setAttribute("aria-expanded", "false");
    });
  }
  if (els.simulatorTenantList) {
    els.simulatorTenantList.addEventListener("click", async (e) => {
      const loginBtn = e.target.closest(".simulator-login-btn:not(.active)");
      if (!loginBtn) return;
      const targetUserId = loginBtn.dataset.userId;
      if (!targetUserId) return;
      loginBtn.disabled = true;
      loginBtn.textContent = "Loading...";
      try {
        const nextAuth = await simulateLogin(targetUserId);
        showToast(`Berhasil masuk sebagai ${nextAuth.user.name} (${nextAuth.tenant.name})`, "success");
        await bootstrapAuthenticatedApp(ctx, nextAuth);
      } catch (error) {
        showToast(error.message, "error");
        loginBtn.disabled = false;
        loginBtn.textContent = "Masuk";
      }
    });
  }
}

// src/js/monitoring.js
init_api();
init_render();
init_toast();
init_app_context();
function bindMonitoringEvents(ctx) {
  const { els } = ctx;
  els.submissionList.addEventListener("click", async (e) => {
    const viewBtn = e.target.closest(".view-submission-btn");
    if (!viewBtn) return;
    const item = viewBtn.closest(".submission-row");
    const submissionId = item.dataset.id;
    await openSubmissionForReview(ctx, submissionId);
  });
  els.studentHistoryList.addEventListener("click", async (e) => {
    const viewBtn = e.target.closest(".view-submission-btn");
    if (!viewBtn) return;
    const item = viewBtn.closest(".submission-row");
    const submissionId = item.dataset.id;
    await openSubmissionForReview(ctx, submissionId);
  });
  async function openSubmissionForReview(ctx2, submissionId) {
    const summary = ctx2.state.submissions.find((s) => s.id === submissionId);
    if (!summary) return;
    let submission = summary;
    try {
      submission = await getSubmissionDetail(submissionId);
    } catch {
    }
    showResult(ctx2.els, submission, ctx2.auth);
  }
  els.resultPanel.addEventListener("click", async (e) => {
    if (e.target.closest(".close-result-btn") || e.target === els.resultPanel) {
      const { closeResultModal: closeResultModal2 } = await Promise.resolve().then(() => (init_app_context(), app_context_exports));
      closeResultModal2(ctx);
      return;
    }
    const complaintBtn = e.target.closest(".complaint-btn");
    if (complaintBtn) {
      const idx2 = parseInt(complaintBtn.dataset.index, 10);
      const submissionId2 = els.resultPanel.dataset.submissionId;
      const submission2 = ctx.state.submissions.find((s) => s.id === submissionId2);
      if (!submission2) return;
      const qs2 = submission2.questionScores[idx2];
      const warning = `\u26A0\uFE0F PERHATIAN

Anda akan mengajukan komplain untuk Soal ${idx2 + 1} (skor ${qs2.score}).

Jika guru menilai bahwa skor yang diberikan sudah sesuai, maka skor soal ini akan dikurangi 20 poin (menjadi ${Math.max(0, qs2.score - 20)}).

Apakah Anda yakin ingin melanjutkan komplain?`;
      if (!await showConfirmDialog(warning, "Komplain")) return;
      const reason = prompt(`Komplain untuk Soal ${idx2 + 1} (skor ${qs2.score}):
Jelaskan alasan Anda merasa nilai kurang sesuai.`);
      if (reason === null) return;
      if (!reason.trim()) {
        showToast("Alasan komplain wajib diisi", "error");
        return;
      }
      try {
        const { submitComplaint: submitComplaint2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const result = await submitComplaint2(submissionId2, idx2, reason);
        const updated = result.submission;
        const localIdx = ctx.state.submissions.findIndex((s) => s.id === submissionId2);
        if (localIdx >= 0) ctx.state.submissions[localIdx] = updated;
        showToast("Komplain terkirim. Guru akan meninjau ulang.", "success");
        showResult(els, updated, ctx.auth);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    const respondBtn = e.target.closest(".respond-complaint-btn");
    if (respondBtn) {
      const idx2 = parseInt(respondBtn.dataset.index, 10);
      const submissionId2 = els.resultPanel.dataset.submissionId;
      const submission2 = ctx.state.submissions.find((s) => s.id === submissionId2);
      if (!submission2) return;
      const qs2 = submission2.questionScores[idx2];
      const newScoreStr2 = prompt(`Re-evaluasi Soal ${idx2 + 1} (skor saat ini: ${qs2.score}):
Masukkan skor baru (0-100):`, qs2.score);
      if (newScoreStr2 === null) return;
      const scoreVal2 = parseInt(newScoreStr2, 10);
      if (isNaN(scoreVal2) || scoreVal2 < 0 || scoreVal2 > 100) {
        showToast("Skor tidak valid. Harus angka 0-100", "error");
        return;
      }
      const response = prompt("Respon untuk siswa (penjelasan keputusan):", "");
      if (response === null) return;
      qs2.score = scoreVal2;
      qs2.complaint = {
        ...qs2.complaint,
        status: "resolved",
        response: String(response || "").trim(),
        resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      submission2.finalScore = Math.round(
        submission2.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission2.questionScores.length
      );
      try {
        await saveSubmissionToDatabase(submission2);
        showToast("Re-evaluasi berhasil disimpan", "success");
        showResult(els, submission2, ctx.auth);
        renderMonitoring(els, ctx.state);
        renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    const rejectBtn = e.target.closest(".reject-complaint-btn");
    if (rejectBtn) {
      const idx2 = parseInt(rejectBtn.dataset.index, 10);
      const submissionId2 = els.resultPanel.dataset.submissionId;
      const submission2 = ctx.state.submissions.find((s) => s.id === submissionId2);
      if (!submission2) return;
      const qs2 = submission2.questionScores[idx2];
      const newScore = Math.max(0, qs2.score - 20);
      const response = prompt(`Tolak komplain untuk Soal ${idx2 + 1}?

Skor akan dikurangi 20 poin: ${qs2.score} \u2192 ${newScore}

Tuliskan penjelasan untuk siswa (opsional):`, "");
      if (response === null) return;
      qs2.score = newScore;
      qs2.complaint = {
        ...qs2.complaint,
        status: "rejected",
        response: String(response || "").trim(),
        resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      submission2.finalScore = Math.round(
        submission2.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission2.questionScores.length
      );
      try {
        await saveSubmissionToDatabase(submission2);
        showToast("Komplain ditolak. Skor dikurangi 20 poin.", "success");
        showResult(els, submission2, ctx.auth);
        renderMonitoring(els, ctx.state);
        renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    const editBtn = e.target.closest(".edit-override-btn");
    if (!editBtn) return;
    const idx = parseInt(editBtn.dataset.index, 10);
    const submissionId = els.resultPanel.dataset.submissionId;
    const submission = ctx.state.submissions.find((s) => s.id === submissionId);
    if (!submission) return;
    const qs = submission.questionScores[idx];
    const newScoreStr = prompt("Masukkan skor baru (0-100):", qs.score);
    if (newScoreStr === null) return;
    const scoreVal = parseInt(newScoreStr, 10);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      showToast("Skor tidak valid. Harus angka 0-100", "error");
      return;
    }
    const newFeedback = prompt("Tambahkan / ubah catatan kelemahan (opsional):", qs.gaps?.join(" ") || "");
    if (newFeedback !== null) {
      qs.gaps = [newFeedback];
    }
    qs.score = scoreVal;
    submission.finalScore = Math.round(
      submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length
    );
    try {
      await saveSubmissionToDatabase(submission);
      showToast("Koreksi berhasil disimpan", "success");
      showResult(els, submission, ctx.auth);
      renderMonitoring(els, ctx.state);
      renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
  if (els.downloadClassCsvBtn) {
    els.downloadClassCsvBtn.addEventListener("click", () => {
      downloadClassCsv(ctx);
    });
  }
  els.assessmentList.addEventListener("click", async (event) => {
    const article = event.target.closest("article");
    if (!article) return;
    const id = article.dataset.id;
    const assessment = ctx.state.assessments.find((a) => a.id === id);
    if (!assessment) return;
    if (event.target.classList.contains("more-menu-trigger")) {
      const menu = event.target.closest(".more-menu");
      const dropdown = menu.querySelector(".more-menu-dropdown");
      const isHidden = dropdown.classList.toggle("hidden");
      event.target.setAttribute("aria-expanded", String(!isHidden));
      document.querySelectorAll(".more-menu-dropdown:not(.hidden)").forEach((d) => {
        if (d !== dropdown) d.classList.add("hidden");
      });
      return;
    }
    if (event.target.classList.contains("close-assessment")) {
      const studentSubmissions = ctx.state.submissions.filter((s) => s.assessmentId === id);
      const impact = studentSubmissions.length ? `${studentSubmissions.length} siswa sudah mengumpulkan. Nilai mereka tetap tersimpan, tetapi siswa lain tidak bisa memulai penilaian ini.` : "Belum ada siswa yang mengumpulkan. Siswa tidak akan bisa memulai penilaian ini.";
      const proceed = await showConfirmDialog(`Tutup akses siswa para penilaian ini?

${impact}

Anda bisa membukanya kembali kapan saja.`, "Tutup Penilaian");
      if (!proceed) return;
      await updateAssessment(id, { status: "closed", classId: assessment.classId });
      await reloadState2(ctx);
      await renderCurrentState2(ctx);
      showToast("Akses siswa ditutup. Siswa tidak bisa memulai penilaian ini.", "success");
    } else if (event.target.classList.contains("reopen-assessment")) {
      await updateAssessment(id, { status: "published", classId: assessment.classId });
      await reloadState2(ctx);
      await renderCurrentState2(ctx);
      showToast("Akses siswa dibuka kembali.", "success");
    } else if (event.target.classList.contains("delete-assessment")) {
      if (!await showConfirmDialog("Hapus penilaian beserta semua submission? Tindakan ini tidak bisa dibatalkan.", "Hapus Penilaian")) return;
      await deleteAssessment(id);
      await reloadState2(ctx);
      await renderCurrentState2(ctx);
    } else if (event.target.classList.contains("edit-assessment")) {
      ctx.pendingAssessmentConfig = {
        id: assessment.id,
        topic: assessment.topic,
        difficulty: assessment.difficulty,
        classId: assessment.classId,
        outcomes: assessment.outcomes,
        rubric: assessment.rubric,
        oralExamEnabled: assessment.oralExamEnabled !== false,
        disableManualTyping: !!assessment.disableManualTyping,
        allowRetakes: !!assessment.allowRetakes
      };
      ctx.pendingQuestions = assessment.questions;
      const { goToWizardStep: goToWizardStep2, renderQuestionEditor: renderQuestionEditor2 } = await Promise.resolve().then(() => (init_assessment_wizard(), assessment_wizard_exports));
      renderQuestionEditor2(ctx);
      goToWizardStep2(ctx, 2);
      await switchView(ctx, "teacherView");
      els.questionEditor.scrollIntoView({ behavior: "smooth" });
    } else if (event.target.classList.contains("download-grades-assessment")) {
      downloadAssessmentGrades(ctx, assessment);
    }
  });
}
function downloadAssessmentGrades(ctx, assessment) {
  const assessmentSubmissions = ctx.state.submissions.filter((s) => s.assessmentId === assessment.id);
  if (!assessmentSubmissions.length) {
    showToast("Belum ada nilai/submission para assessment ini.", "error");
    return;
  }
  const latestSubmissionsMap = /* @__PURE__ */ new Map();
  assessmentSubmissions.forEach((sub) => {
    const key = sub.studentName;
    const existing = latestSubmissionsMap.get(key);
    if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
      latestSubmissionsMap.set(key, sub);
    }
  });
  const latestSubmissions = Array.from(latestSubmissionsMap.values());
  latestSubmissions.sort((a, b) => a.studentName.localeCompare(b.studentName));
  const escapeCsv = (val) => {
    if (val === null || val === void 0) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvRows = [];
  csvRows.push(["Nama Siswa", "Email", "Skor Akhir", "Tanggal Pengerjaan"].map(escapeCsv).join(","));
  latestSubmissions.forEach((sub) => {
    const membership = ctx.state.memberships.find(
      (m) => m.student_name === sub.studentName && m.class_id === assessment.classId
    );
    const email = membership ? membership.student_email || "-" : "-";
    const formattedDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "-";
    csvRows.push([sub.studentName, email, sub.finalScore, formattedDate].map(escapeCsv).join(","));
  });
  const csvContent = "\uFEFFsep=,\n" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const safeTopicName = assessment.topic.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  link.setAttribute("download", `nilai_${safeTopicName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV Nilai Assessment berhasil didownload.", "success");
}
function downloadClassCsv(ctx) {
  const { els } = ctx;
  const classId = els.monitorClassFilter?.value;
  if (!classId) {
    showToast("Pilih kelas terlebih dahulu para download nilai.", "error");
    return;
  }
  const selectedClass = ctx.state.classes.find((c) => c.id === classId);
  const className = selectedClass ? selectedClass.name : "Kelas";
  const classSubmissions = ctx.state.submissions.filter((s) => s.classId === classId);
  if (!classSubmissions.length) {
    showToast("Belum ada nilai/submission di kelas ini.", "error");
    return;
  }
  const latestSubmissionsMap = /* @__PURE__ */ new Map();
  classSubmissions.forEach((sub) => {
    const key = `${sub.studentName}_${sub.assessmentId}`;
    const existing = latestSubmissionsMap.get(key);
    if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
      latestSubmissionsMap.set(key, sub);
    }
  });
  const latestSubmissions = Array.from(latestSubmissionsMap.values());
  latestSubmissions.sort((a, b) => {
    const nameCompare = a.studentName.localeCompare(b.studentName);
    if (nameCompare !== 0) return nameCompare;
    return a.assessmentTitle.localeCompare(b.assessmentTitle);
  });
  const escapeCsv = (val) => {
    if (val === null || val === void 0) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvRows = [];
  csvRows.push(["Nama Siswa", "Email", "Topik Assessment", "Skor Akhir", "Tanggal Pengerjaan"].map(escapeCsv).join(","));
  latestSubmissions.forEach((sub) => {
    const membership = ctx.state.memberships.find(
      (m) => m.student_name === sub.studentName && m.class_id === classId
    );
    const email = membership ? membership.student_email || "-" : "-";
    const formattedDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "-";
    csvRows.push([sub.studentName, email, sub.assessmentTitle, sub.finalScore, formattedDate].map(escapeCsv).join(","));
  });
  const csvContent = "\uFEFFsep=,\n" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const safeClassName = className.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  link.setAttribute("download", `nilai_${safeClassName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV berhasil didownload.", "success");
}
async function reloadState2(ctx) {
  const { loadState: loadState2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const nextState = await loadState2();
  ctx.state.assessments = nextState.assessments;
  ctx.state.submissions = nextState.submissions;
  ctx.state.classes = nextState.classes;
  ctx.state.memberships = nextState.memberships;
}

// src/js/demo-data.js
init_api();
init_toast();
init_app_context();
function bindDemoDataEvents(ctx) {
  const { els } = ctx;
  if (els.seedDemoTeacher) {
    els.seedDemoTeacher.addEventListener("click", async () => {
      if (ctx.state.assessments.length) {
        showToast("Data contoh sudah ada. Gunakan 'Hapus data dummy' untuk mengisi ulang.");
        return;
      }
      try {
        const result = await seedDemoData("teacher");
        await refreshDemoState(ctx);
        showToast(
          `Data contoh guru dibuat: ${result.assessmentsAdded} penilaian, ${result.studentsAdded} siswa.`,
          "success"
        );
      } catch (error) {
        showToast(`Gagal mengisi data contoh guru: ${error.message}`);
      }
    });
  }
  if (els.seedDemoAdmin) {
    els.seedDemoAdmin.addEventListener("click", async () => {
      try {
        const result = await seedDemoData("admin");
        await refreshDemoState(ctx);
        showToast(
          `Data contoh admin siap: observabilitas, riset (${result.runsCreated} run), dan API keys.`,
          "success"
        );
      } catch (error) {
        showToast(`Gagal mengisi data contoh admin: ${error.message}`);
      }
    });
  }
  if (els.removeDemoData) {
    els.removeDemoData.addEventListener("click", async () => {
      if (!await showConfirmDialog("Hapus data dummy (data contoh) saja? Data asli Anda tetap aman.", "Hapus Data Dummy")) return;
      try {
        const { removeDemoData: removeDemoData2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const result = await removeDemoData2();
        await refreshDemoState(ctx);
        showToast(
          `Data dummy dihapus: ${result.removed} baris.`,
          "success"
        );
      } catch (error) {
        showToast(`Gagal menghapus data dummy: ${error.message}`, "error");
      }
    });
  }
}
async function refreshDemoState(ctx) {
  const { loadState: loadState2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const next = await loadState2();
  ctx.state.assessments = next.assessments;
  ctx.state.submissions = next.submissions;
  ctx.state.classes = next.classes;
  ctx.state.memberships = next.memberships;
  if (ctx.auth.user.role === "admin") {
    const { loadUsers: loadUsers2 } = await Promise.resolve().then(() => (init_app_context(), app_context_exports));
    ctx.users = await loadUsers2(ctx);
    const { renderUsers: renderUsers2 } = await Promise.resolve().then(() => (init_user_management(), user_management_exports));
    renderUsers2(ctx);
  }
  await renderCurrentState(ctx);
  await refreshSimulatorIfEnabled(ctx);
}

// src/js/main.js
init_complaints();
init_api_keys();
init_research();
init_observability();
init_dashboard();
init_question_bank();
init_notifications();
async function initApp() {
  const ctx = createAppContext();
  ctx.auth = await getCurrentUser();
  bindAuthEvents(ctx);
  bindAssessmentWizardEvents(ctx);
  enhanceAssessmentWizardUX(ctx);
  bindStudentFlowEvents(ctx);
  bindClassManagementEvents(ctx);
  bindUserManagementEvents(ctx);
  bindSimulatorEvents(ctx);
  bindMonitoringEvents(ctx);
  bindDemoDataEvents(ctx);
  bindComplaintEvents(ctx);
  bindApiKeyEvents(ctx);
  bindResearchEvents(ctx);
  bindObservabilityEvents(ctx);
  bindDashboardEvents(ctx);
  bindQuestionBankEvents(ctx);
  if (ctx.auth.authenticated && ["admin", "teacher"].includes(ctx.auth.user.role)) {
    startNotificationListener(ctx);
  }
  ctx.els.mainNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-button");
    if (btn) switchView(ctx, btn.dataset.view);
  });
  window.addEventListener("popstate", () => {
    if (!ctx.auth?.authenticated) return;
    const viewId = history.state?.lisanView;
    if (viewId) switchView(ctx, viewId, { fromHistory: true });
  });
  document.addEventListener("click", async (e) => {
    const filterBtn = e.target.closest("[data-student-filter]");
    if (filterBtn) {
      document.querySelectorAll("[data-student-filter]").forEach((b) => {
        b.classList.toggle("active", b === filterBtn);
      });
      const { renderStudentArea: renderStudentArea2 } = await Promise.resolve().then(() => (init_render(), render_exports));
      renderStudentArea2(ctx.els, ctx.state, ctx.session);
      return;
    }
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav-view]");
    if (btn) switchView(ctx, btn.dataset.navView);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".more-menu")) {
      document.querySelectorAll(".more-menu-dropdown:not(.hidden)").forEach((d) => {
        d.classList.add("hidden");
        const trigger = d.closest(".more-menu")?.querySelector(".more-menu-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }
  });
  const { refreshSimulatorIfEnabled: refreshSimulatorIfEnabled2 } = await Promise.resolve().then(() => (init_app_context(), app_context_exports));
  refreshSimulatorIfEnabled2(ctx);
  const savedTheme = localStorage.getItem("lisan-theme");
  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", theme === "dark");
    root.classList.toggle("light-mode", theme === "light");
    localStorage.setItem("lisan-theme", theme);
    if (ctx.els.darkModeToggle) {
      ctx.els.darkModeToggle.innerHTML = theme === "dark" ? '<span aria-hidden="true">\u2600\uFE0F</span><span>Mode Terang</span>' : '<span aria-hidden="true">\u{1F319}</span><span>Mode Gelap</span>';
    }
  };
  if (savedTheme === "dark") applyTheme("dark");
  else if (savedTheme === "light") applyTheme("light");
  if (ctx.els.darkModeToggle) {
    ctx.els.darkModeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.classList.contains("dark-mode");
      applyTheme(isDark ? "light" : "dark");
    });
  }
  if (ctx.els.hamburgerBtn) {
    ctx.els.hamburgerBtn.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar");
      sidebar.classList.toggle("nav-open");
      ctx.els.hamburgerBtn.classList.toggle("open");
      ctx.els.hamburgerBtn.setAttribute(
        "aria-expanded",
        sidebar.classList.contains("nav-open") ? "true" : "false"
      );
    });
    document.querySelector(".sidebar")?.addEventListener("click", (e) => {
      if (e.target.closest(".nav-button") || e.target.closest(".nav-sub-item")) {
        if (window.innerWidth <= 900) {
          document.querySelector(".sidebar").classList.remove("nav-open");
          ctx.els.hamburgerBtn.classList.remove("open");
          ctx.els.hamburgerBtn.setAttribute("aria-expanded", "false");
        }
      }
    });
  }
  if (ctx.auth.authenticated) {
    await bootstrapAuthenticatedApp(ctx, ctx.auth);
  } else {
    showAuth(ctx);
  }
}

// src/js/app.js
initApp().catch((error) => {
  console.error(error);
  alert(`Aplikasi gagal dijalankan: ${error.message}`);
});
//# sourceMappingURL=app.bundle.js.map
