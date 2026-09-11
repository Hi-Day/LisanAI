const GATE_TIMEOUT_MS = 30000;
const POLL_MS = 2000;
let installed = false;
let originalFetch = null;
let teacherTimer = null;
let teacherReady = false;

export function installProbingGate() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const bodyText = init?.body;
    if (!url.endsWith("/api/assessment") || typeof bodyText !== "string") {
      return originalFetch(input, init);
    }

    let body;
    try { body = JSON.parse(bodyText); } catch { return originalFetch(input, init); }
    if (body?.action !== "generate-probing" || body?.stream !== true) {
      return originalFetch(input, init);
    }

    const response = await originalFetch(input, init);
    if (!response.ok || !response.body) return response;

    const text = await response.text();
    let result = null;
    for (const event of text.split("\n\n")) {
      const line = event.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      try {
        const parsed = JSON.parse(line.slice(5).trim());
        if (parsed.type === "result") result = parsed.data?.probing || null;
      } catch {}
    }
    if (!result?.prompt) return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });

    try {
      const gate = await createGate(body.payload || {}, result, init.headers || {});
      if (gate?.id) {
        showStudentGateWaiting(gate);
        const decision = await waitForDecision(gate.id);
        hideStudentGateWaiting();
        if (decision?.status === "skipped" || decision?.status === "terminated") {
          return buildProbeResponse(text, { prompt: "", status: decision.status });
        }
        const approved = decision?.approvedPrompt || result.prompt;
        const rewritten = replaceProbeResult(text, { ...result, prompt: approved, gateDecision: decision?.status || "accepted" });
        return buildProbeResponse(rewritten, { prompt: approved });
      }
    } catch (error) {
      console.warn("[probing-gate] teacher gate unavailable; continuing with AI probe", error);
    }
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  };

  bootTeacherPanel();
}

async function createGate(payload, result, headers) {
  const gatePayload = {
    assessmentId: payload.assessmentId || payload.assessment_id,
    questionIndex: Number(payload.questionIndex ?? payload.question_index ?? 0),
    answer: payload.answer || "",
    evidenceGap: result.evidenceGap || payload.evidenceGap || null,
    prompt: result.prompt,
  };
  // The current student probing payload does not yet include assessmentId.
  // Without it the server cannot safely associate the probe with a teacher.
  if (!gatePayload.assessmentId) return null;
  const response = await originalFetch("/api/probing", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ action: "create", payload: gatePayload }),
  });
  if (!response.ok) return null;
  return (await response.json()).probe;
}

async function waitForDecision(id) {
  const deadline = Date.now() + GATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await originalFetch(`/api/probing?action=status&id=${encodeURIComponent(id)}`, { credentials: "include" });
    if (response.ok) {
      const data = await response.json();
      if (data.probe && data.probe.status !== "pending") return data.probe;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  // Server-side expiry will auto-accept the probe on the next status request.
  const response = await originalFetch(`/api/probing?action=status&id=${encodeURIComponent(id)}`, { credentials: "include" });
  if (response.ok) return (await response.json()).probe;
  return { status: "accepted" };
}

function replaceProbeResult(text, probing) {
  const events = text.split("\n\n");
  return events.map((event) => {
    const line = event.split("\n").find((item) => item.startsWith("data:"));
    if (!line) return event;
    try {
      const parsed = JSON.parse(line.slice(5).trim());
      if (parsed.type === "result") {
        parsed.data = { ...(parsed.data || {}), probing };
        return `data: ${JSON.stringify(parsed)}`;
      }
    } catch {}
    return event;
  }).join("\n\n");
}

function buildProbeResponse(text, meta = {}) {
  const headers = new Headers({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" });
  return new Response(text, { status: 200, headers });
}

function showStudentGateWaiting(probe) {
  const question = document.getElementById("activeQuestion");
  if (question) {
    question.innerHTML = `<span class="probing-badge">⚡ Menunggu keputusan guru</span><span class="probing-text">Guru sedang meninjau pertanyaan lanjutan...</span>`;
    question.classList.add("probing-active");
  }
  const answer = document.getElementById("answerText");
  if (answer) answer.readOnly = true;
  const save = document.getElementById("saveAnswer");
  if (save) { save.disabled = true; save.textContent = "Menunggu guru..."; }
  void probe;
}

function hideStudentGateWaiting() {
  const save = document.getElementById("saveAnswer");
  if (save) save.disabled = false;
}

async function bootTeacherPanel() {
  if (teacherReady) return;
  try {
    const me = await originalFetch("/api/auth?action=me", { credentials: "include" });
    if (!me.ok) return;
    const auth = await me.json();
    if (!["teacher", "admin"].includes(auth.user?.role)) return;
    teacherReady = true;
    ensureTeacherPanel();
    refreshTeacherPanel();
    teacherTimer = window.setInterval(refreshTeacherPanel, POLL_MS);
  } catch {}
}

function ensureTeacherPanel() {
  if (document.getElementById("probingGatePanel")) return;
  const view = document.getElementById("teacherView");
  if (!view) return;
  const panel = document.createElement("section");
  panel.id = "probingGatePanel";
  panel.className = "probing-gate-panel";
  panel.innerHTML = `<div class="probing-gate-heading"><div><h3>⚡ Probing menunggu keputusan</h3><p>Siswa hanya menerima probe setelah guru menyetujui atau mengeditnya. Maksimal 1 probe per soal.</p></div><span class="tag" id="probingGateCount">0</span></div><div id="probingGateList"></div>`;
  view.prepend(panel);
}

async function refreshTeacherPanel() {
  if (!teacherReady) return;
  ensureTeacherPanel();
  const panel = document.getElementById("probingGatePanel");
  const list = document.getElementById("probingGateList");
  if (!panel || !list) return;
  try {
    const response = await originalFetch("/api/probing?action=pending", { credentials: "include" });
    if (!response.ok) return;
    const probes = (await response.json()).probes || [];
    document.getElementById("probingGateCount").textContent = String(probes.length);
    list.innerHTML = probes.length ? probes.map(renderProbeCard).join("") : `<div class="probing-gate-empty">Tidak ada probing yang menunggu.</div>`;
    bindDecisionButtons(list);
  } catch {}
}

function renderProbeCard(probe) {
  const gap = probe.evidenceGap?.label || probe.evidenceGap?.type || "evidence gap";
  return `<article class="probing-gate-card" data-probe-id="${escapeAttr(probe.id)}"><div class="probing-gate-meta"><strong>${escapeHtml(probe.studentName || "Siswa")}</strong><span>${escapeHtml(probe.assessmentTitle || "Assessment")} · Soal ${probe.questionIndex + 1}</span></div><div class="probing-gate-gap"><b>Evidence gap:</b> ${escapeHtml(gap)}</div><div class="probing-gate-answer"><b>Jawaban siswa:</b><p>${escapeHtml(probe.answer || "-")}</p></div><div class="probing-gate-proposal"><b>Probe yang disarankan:</b><p class="probe-text">${escapeHtml(probe.proposedPrompt)}</p></div><div class="probing-gate-actions"><button type="button" class="primary-button probe-accept">Terima</button><button type="button" class="secondary-button probe-edit">Edit &amp; kirim</button><button type="button" class="action-button probe-skip">Lewati</button><button type="button" class="danger-button probe-terminate">Hentikan</button></div></article>`;
}

function bindDecisionButtons(list) {
  list.querySelectorAll(".probing-gate-card").forEach((card) => {
    if (card.dataset.bound) return;
    card.dataset.bound = "1";
    card.querySelector(".probe-accept")?.addEventListener("click", () => decide(card, "accepted"));
    card.querySelector(".probe-edit")?.addEventListener("click", () => {
      const current = card.querySelector(".probe-text")?.textContent || "";
      const edited = window.prompt("Edit pertanyaan probing sebelum dikirim ke siswa:", current);
      if (edited === null) return;
      if (!edited.trim()) return window.alert("Pertanyaan probing tidak boleh kosong.");
      decide(card, "accepted", edited.trim());
    });
    card.querySelector(".probe-skip")?.addEventListener("click", () => decide(card, "skipped"));
    card.querySelector(".probe-terminate")?.addEventListener("click", () => decide(card, "terminated"));
  });
}

async function decide(card, decision, editedPrompt = "") {
  const id = card.dataset.probeId;
  const response = await originalFetch("/api/probing", {
    method: "POST",
    credentials: "include",
    headers: await csrfHeaders(),
    body: JSON.stringify({ action: "decide", payload: { id, decision, editedPrompt } }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    window.alert(data.error || "Keputusan probe gagal disimpan.");
    return;
  }
  card.remove();
  refreshTeacherPanel();
}

async function csrfHeaders() {
  const response = await originalFetch("/api/auth?action=me", { credentials: "include" });
  const data = response.ok ? await response.json() : {};
  const headers = { "Content-Type": "application/json" };
  if (data.csrfToken) headers["X-CSRF-Token"] = data.csrfToken;
  return headers;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }

if (typeof window !== "undefined") {
  window.setTimeout(installProbingGate, 0);
}
