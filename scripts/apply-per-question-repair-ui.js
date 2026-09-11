const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "pedagogical-gate.js");

const source = fs.readFileSync(FILE, "utf8");

const start = source.indexOf("async function requestRepair(mode, result, gate) {");
const end = source.indexOf("\n\nfunction renderRepairPreview", start);

if (start === -1 || end === -1) {
  throw new Error("Streaming pedagogical repair function target not found.");
}

const replacement = String.raw`async function requestRepair(mode, result, gate) {
  const bridge = window.__lisanAssessmentWizardBridge;
  if (!bridge?.ctx) throw new Error("Assessment wizard belum siap.");
  bridge.sync();
  const ctx = bridge.ctx;
  const beforeQuestions = (ctx.pendingQuestions || []).map((question) => ({
    ...question,
    criteria: Array.isArray(question.criteria) ? question.criteria.map((c) => ({ ...c })) : [],
  }));
  const domQuestions = collectQuestions();
  const questions = beforeQuestions.map((question, index) => ({
    ...question,
    prompt: domQuestions[index]?.prompt || question.prompt,
    focus: domQuestions[index]?.focus || question.focus,
    outcome: domQuestions[index]?.outcome || question.outcome,
    ideal: domQuestions[index]?.ideal || question.ideal,
  }));

  const affectedIndexes = [...new Set((result.issues || [])
    .map((issue) => Number(issue.index ?? issue.questionIndex))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < questions.length))]
    .sort((a, b) => a - b);

  const host = gate?.querySelector(".gate-repair-preview");
  if (!host) throw new Error("Panel preview repair tidak ditemukan.");

  host.innerHTML = `<div class="repair-meta">AI memperbaiki satu soal pada satu waktu. Soal sebelum langsung ditampilkan; hasil sesudah akan muncul saat token AI diterima.</div><div class="repair-preview repair-preview-streaming"></div>`;
  const preview = host.querySelector(".repair-preview-streaming");
  const afterNodes = new Map();
  const afterQuestions = [...questions];

  for (const index of affectedIndexes) {
    const question = questions[index];
    const card = document.createElement("article");
    card.className = "repair-question-pair";
    card.innerHTML = `<div class="repair-card before"><strong>Sebelum — Soal ${index + 1}</strong><div>${escapeHtml(question.prompt || "")}</div><p>${escapeHtml(questionSummary(question))}</p></div><div class="repair-card after"><strong>Sesudah — Soal ${index + 1}</strong><div class="repair-stream-output" data-question-index="${index}"><span class="repair-stream-placeholder">✨ AI sedang menyiapkan soal...</span></div><p class="repair-stream-meta">Menunggu stream AI…</p></div>`;
    preview.appendChild(card);
    afterNodes.set(index, {
      output: card.querySelector(".repair-stream-output"),
      meta: card.querySelector(".repair-stream-meta"),
    });
  }

  const applyRow = document.createElement("div");
  applyRow.className = "repair-apply-row";
  applyRow.innerHTML = `<button type="button" class="primary-button apply-repair" disabled>✓ Terapkan semua perubahan</button><button type="button" class="secondary-button reject-repair">Tolak</button>`;
  host.appendChild(applyRow);

  const topic = document.getElementById("topic")?.value?.trim() || ctx.pendingAssessmentConfig?.topic || "";
  const outcomes = document.getElementById("outcomes")?.value?.trim() || ctx.pendingAssessmentConfig?.outcomes || "";
  const csrfToken = await getCsrfToken();

  const extractPrompt = (text) => {
    const raw = String(text || "");
    const marker = /"prompt"\s*:\s*"/i.exec(raw);
    if (!marker) return "";
    const startAt = marker.index + marker[0].length;
    let escaped = false;
    let value = "";
    for (let i = startAt; i < raw.length; i += 1) {
      const char = raw[i];
      if (escaped) {
        value += char === "n" ? "\n" : char === "r" ? "\r" : char === "t" ? "\t" : char;
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        break;
      } else {
        value += char;
      }
    }
    return value;
  };

  const parseSse = async (response, index) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `AI gagal memperbaiki Soal ${index + 1}.`);
    }
    if (!response.body) throw new Error("Browser tidak mendukung streaming AI.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedText = "";
    let finalData = null;

    const updateOutput = () => {
      const nodes = afterNodes.get(index);
      if (!nodes) return;
      const prompt = extractPrompt(streamedText);
      if (prompt) {
        nodes.output.innerHTML = escapeHtml(prompt).replace(/\n/g, "<br>");
        nodes.meta.textContent = `✨ AI sedang menyusun Soal ${index + 1}…`;
      } else if (streamedText.trim()) {
        nodes.output.innerHTML = `<span class="repair-stream-placeholder">✨ AI sedang menyusun…</span>`;
        nodes.meta.textContent = "Menerima output AI…";
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        let packet;
        try {
          packet = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (packet.type === "chunk") {
          streamedText += packet.text || "";
          updateOutput();
        } else if (packet.type === "result") {
          finalData = packet.data;
        } else if (packet.type === "error") {
          throw new Error(packet.message || `AI gagal memperbaiki Soal ${index + 1}.`);
        }
      }
    }

    if (!finalData?.questions?.[0]) throw new Error(`AI tidak mengembalikan hasil untuk Soal ${index + 1}.`);
    const repaired = finalData.questions[0];
    afterQuestions[index] = {
      ...questions[index],
      ...repaired,
      id: questions[index]?.id || repaired.id,
      probing: questions[index]?.probing ?? repaired.probing,
    };
    const nodes = afterNodes.get(index);
    if (nodes) {
      nodes.output.innerHTML = escapeHtml(afterQuestions[index].prompt || "Tidak ada prompt yang dikembalikan.").replace(/\n/g, "<br>");
      nodes.meta.textContent = `✓ Selesai · ${finalData.repairedBy === "ai" ? "AI" : "AI + pemeriksaan deterministik"} · ${questionSummary(afterQuestions[index])}`;
    }
  };

  let failed = false;
  for (const index of affectedIndexes) {
    const nodes = afterNodes.get(index);
    if (nodes) nodes.meta.textContent = `⏳ Memproses Soal ${index + 1}…`;
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          action: "repair-pedagogical-grounding",
          stream: true,
          payload: {
            mode,
            topic,
            outcomes,
            issues: (result.issues || []).filter((issue) => Number(issue.index ?? issue.questionIndex) === index),
            questions: [questions[index]],
          },
        }),
      });
      await parseSse(response, index);
    } catch (error) {
      failed = true;
      const nodes = afterNodes.get(index);
      if (nodes) {
        nodes.output.innerHTML = `<span class="repair-stream-error">⚠ ${escapeHtml(error.message)}</span>`;
        nodes.meta.textContent = "Gagal diproses.";
      }
    }
  }

  const applyButton = applyRow.querySelector(".apply-repair");
  if (!failed) {
    applyButton.disabled = false;
    applyButton.addEventListener("click", () => {
      const wizard = window.__lisanAssessmentWizardBridge;
      if (!wizard?.ctx) return;
      wizard.ctx.pendingQuestions = afterQuestions;
      wizard.render();
      const nextResult = validateQuestions();
      showGateAtQuestionEditor(nextResult);
      const status = document.querySelector(".pedagogical-gate .gate-repair-status");
      if (status) status.textContent = nextResult.valid
        ? "✓ Semua perubahan diterapkan dan Quality Gate lulus."
        : "⚠ Perubahan diterapkan, tetapi masih ada masalah yang perlu ditinjau.";
    });
  } else {
    applyButton.textContent = "⚠ Ada soal yang gagal — coba lagi";
    applyButton.disabled = true;
  }

  host.querySelector(".reject-repair").addEventListener("click", () => {
    host.innerHTML = "<p class=\"gate-repair-status\">Perubahan AI ditolak. Soal dan rubrik tetap seperti semula.</p>";
    gate.querySelectorAll(".pedagogical-repair-btn").forEach((button) => { button.disabled = false; });
  });

  return { data: { repairedBy: failed ? "partial-error" : "ai" }, beforeQuestions, afterQuestions };
}`;

const updated = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(FILE, updated, "utf8");
console.log("Applied per-question pedagogical repair streaming UI.");
