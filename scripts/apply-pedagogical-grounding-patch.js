const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function replaceOnce(file, find, replace, label) {
  const filePath = path.join(ROOT, file);
  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes(replace)) {
    console.log(`Pedagogical grounding already applied: ${label}`);
    return false;
  }
  if (!source.includes(find)) {
    throw new Error(`Pedagogical grounding patch target not found: ${file} :: ${label}`);
  }
  fs.writeFileSync(filePath, source.replace(find, replace), "utf8");
  console.log(`Applied pedagogical grounding patch: ${label}`);
  return true;
}

function apply() {
  replaceOnce(
    "server/harness/alignment.js",
    'const learningOutcomeAlignment = require("./learning-outcome-alignment");',
    'const learningOutcomeAlignment = require("./learning-outcome-alignment");\nconst { groundQuestionsAgainstRubric } = require("./question-grounding");',
    "alignment import"
  );

  replaceOnce(
    "server/harness/alignment.js",
    "  return enforceLearningOutcomeAlignment(finalized, payload);",
    "  return enforceLearningOutcomeAlignment(groundQuestionsAgainstRubric(finalized, payload), payload);",
    "alignment grounding gate"
  );

  replaceOnce(
    "server/harness/alignment.js",
    "function enforceRubricAlignment(questions, payload) {",
    `function syncRubricWithGroundedCriteria(question, allCriteria) {
  if (!question || !Array.isArray(question.criteria)) return question;
  const selectedIds = new Set(question.criteria.map((criterion) => String(typeof criterion === "object" ? criterion.id || criterion.name : criterion)));
  if (selectedIds.size === 0) return { ...question, rubric: "" };

  const sourceRubric = String(question.rubric || "").trim();
  if (sourceRubric.startsWith("{")) {
    try {
      const parsed = JSON.parse(sourceRubric);
      if (parsed.version === "2" && Array.isArray(parsed.criteria)) {
        const selected = parsed.criteria.filter((criterion) => {
          const id = String(criterion.id || criterion.name || "");
          const name = normalizeCriterionName(criterion.name || "");
          return selectedIds.has(id) || [...selectedIds].some((selectedId) => normalizeCriterionName(selectedId) === name);
        });
        if (selected.length) {
          const total = selected.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0) || selected.length;
          const normalized = selected.map((criterion, index) => ({
            ...criterion,
            weight: index === selected.length - 1
              ? Number((100 - selected.slice(0, -1).reduce((sum, item) => sum + Math.round(((Number(item.weight) || 0) / total) * 100), 0)).toFixed(2))
              : Number((((Number(criterion.weight) || 0) / total) * 100).toFixed(2)),
          }));
          return { ...question, rubric: JSON.stringify({ ...parsed, criteria: normalized }) };
        }
      }
    } catch { /* fall through to generated subset rubric */ }
  }

  const subsetText = buildQuestionRubricText(question, allCriteria);
  return subsetText ? { ...question, rubric: subsetText } : question;
}

function enforceRubricAlignment(questions, payload) {`,
    "rubric synchronization"
  );

  replaceOnce(
    "server/harness/alignment.js",
    "  return enforceLearningOutcomeAlignment(groundQuestionsAgainstRubric(finalized, payload), payload);",
    "  return enforceLearningOutcomeAlignment(groundQuestionsAgainstRubric(finalized.map((question) => syncRubricWithGroundedCriteria(question, criteria), payload), payload), payload);",
    "sync rubric after grounding"
  );

  replaceOnce(
    "server/assessment-service.js",
    '          "Seluruh kriteria dalam daftar kriteria_rubrik_yang_tersedia wajib muncul di setidaknya satu soal.",',
    '          "Setiap criterion hanya boleh muncul pada soal jika pertanyaan tersebut secara eksplisit meminta evidence yang diperlukan criterion itu. Jangan memaksakan criterion hanya demi coverage; jika tidak grounded, jangan mapping-kan ke soal.",',
    "generation criterion grounding rule"
  );

  replaceOnce(
    "server/assessment-service.js",
    '        aturan_rubrik_per_soal: "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan yang dibuat dan learning_outcome. Rubrik harus berisi 3-4 indikator yang dapat diamati, lengkap dengan bobot total 100%, dan hanya menilai isi yang benar-benar diminta oleh pertanyaan serta selaras dengan learning outcome.",',
    '        aturan_rubrik_per_soal: "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan dan learning_outcome. Setiap criterion harus memiliki evidence demand yang eksplisit di pertanyaan. Jangan menambahkan indikator contoh, penerapan, alasan, analisis, perbandingan, atau evaluasi jika pertanyaan tidak memintanya. Jika criterion tidak dapat dibuktikan dari jawaban atas pertanyaan, jangan mapping-kan criterion tersebut.",',
    "generation rubric evidence rule"
  );

  replaceOnce(
    "src/js/assessment-wizard.js",
    "  _wizardCtx = ctx;\n  const { els } = ctx;",
    "  _wizardCtx = ctx;\n  window.__lisanAssessmentWizardBridge = {\n    get ctx() { return _wizardCtx; },\n    sync() { if (_wizardCtx) syncQuestionsFromEditor(_wizardCtx); },\n    render() { if (_wizardCtx) renderQuestionEditor(_wizardCtx); },\n  };\n  const { els } = ctx;",
    "wizard repair bridge"
  );

  replaceOnce(
    "src/js/pedagogical-gate.js",
    `async function requestRepair(mode, result) {
  const bridge = window.__lisanAssessmentWizardBridge;
  if (!bridge?.ctx) throw new Error("Assessment wizard belum siap.");
  bridge.sync();
  const ctx = bridge.ctx;
  const beforeQuestions = (ctx.pendingQuestions || []).map((question) => ({ ...question, criteria: Array.isArray(question.criteria) ? question.criteria.map((c) => ({ ...c })) : [] }));
  const domQuestions = collectQuestions();
  const questions = beforeQuestions.map((question, index) => ({
    ...question,
    prompt: domQuestions[index]?.prompt || question.prompt,
    focus: domQuestions[index]?.focus || question.focus,
    outcome: domQuestions[index]?.outcome || question.outcome,
    ideal: domQuestions[index]?.ideal || question.ideal,
  }));
  const topic = document.getElementById("topic")?.value?.trim() || ctx.pendingAssessmentConfig?.topic || "";
  const outcomes = document.getElementById("outcomes")?.value?.trim() || ctx.pendingAssessmentConfig?.outcomes || "";
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({
      action: "repair-pedagogical-grounding",
      payload: { mode, topic, outcomes, issues: result.issues, questions },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI gagal memperbaiki grounding.");
  if (!Array.isArray(data.questions) || data.questions.length !== questions.length) throw new Error("AI mengembalikan jumlah soal yang tidak sesuai.");
  return { data, beforeQuestions, afterQuestions: data.questions };
}`,
    `async function requestRepair(mode, result, gate) {
  const bridge = window.__lisanAssessmentWizardBridge;
  if (!bridge?.ctx) throw new Error("Assessment wizard belum siap.");
  bridge.sync();
  const ctx = bridge.ctx;
  const beforeQuestions = (ctx.pendingQuestions || []).map((question) => ({ ...question, criteria: Array.isArray(question.criteria) ? question.criteria.map((c) => ({ ...c })) : [] }));
  const domQuestions = collectQuestions();
  const questions = beforeQuestions.map((question, index) => ({
    ...question,
    prompt: domQuestions[index]?.prompt || question.prompt,
    focus: domQuestions[index]?.focus || question.focus,
    outcome: domQuestions[index]?.outcome || question.outcome,
    ideal: domQuestions[index]?.ideal || question.ideal,
  }));
  const topic = document.getElementById("topic")?.value?.trim() || ctx.pendingAssessmentConfig?.topic || "";
  const outcomes = document.getElementById("outcomes")?.value?.trim() || ctx.pendingAssessmentConfig?.outcomes || "";
  const csrfToken = await getCsrfToken();

  const streamHost = gate?.querySelector(".gate-repair-stream");
  const renderStream = (text, done = false) => {
    if (!streamHost) return;
    const raw = String(text || "");
    const prompts = [];
    const regex = /"prompt"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)/g;
    let match;
    while ((match = regex.exec(raw))) {
      try { prompts.push(JSON.parse(`"${match[1]}"`)); } catch { /* partial JSON string */ }
    }
    const unique = [...new Set(prompts.map((value) => value.trim()).filter(Boolean))];
    if (!unique.length) {
      streamHost.innerHTML = `<div class="repair-stream-label">✨ AI menyusun usulan...</div><div class="repair-stream-text">${escapeHtml(raw.slice(-420))}</div>`;
      return;
    }
    streamHost.innerHTML = `<div class="repair-stream-label">✨ Usulan AI</div>${unique.map((prompt, index) => `<div class="repair-stream-item"><strong>Soal ${index + 1}</strong><span>${escapeHtml(prompt)}</span></div>`).join("")}${done ? "" : "<span class=\"repair-stream-caret\" aria-hidden=\"true\"></span>"}`;
  };

  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({
      action: "repair-pedagogical-grounding",
      stream: true,
      payload: { mode, topic, outcomes, issues: result.issues, questions },
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "AI gagal memperbaiki grounding.");
  }
  if (!response.body) throw new Error("Browser tidak mendukung streaming AI.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamedText = "";
  let data = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\\n\\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const line = event.split("\\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      try {
        const packet = JSON.parse(line.slice(6));
        if (packet.type === "chunk") {
          streamedText += packet.text || "";
          renderStream(streamedText, false);
        } else if (packet.type === "result") {
          data = packet.data;
        } else if (packet.type === "error") {
          throw new Error(packet.message || "AI gagal memperbaiki grounding.");
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  if (!data) throw new Error("AI tidak mengembalikan hasil repair.");
  renderStream(streamedText, true);
  if (!Array.isArray(data.questions) || data.questions.length !== questions.length) throw new Error("AI mengembalikan jumlah soal yang tidak sesuai.");
  return { data, beforeQuestions, afterQuestions: data.questions };
}`,
    "streaming repair request"
  );

  replaceOnce(
    "src/js/pedagogical-gate.js",
    '<p class="gate-repair-status" aria-live="polite"></p><div class="gate-repair-preview"></div>',
    '<p class="gate-repair-status" aria-live="polite"></p><div class="gate-repair-stream" aria-live="polite"></div><div class="gate-repair-preview"></div>',
    "streaming repair panel"
  );

  replaceOnce(
    "src/js/pedagogical-gate.js",
    ".pedagogical-gate .gate-repair-status { margin-top: 10px; font-size: .9rem; }",
    ".pedagogical-gate .gate-repair-status { margin-top: 10px; font-size: .9rem; }\n    .pedagogical-gate .gate-repair-stream { margin-top: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--panel); }\n    .pedagogical-gate .repair-stream-label { font-weight: 700; margin-bottom: 8px; }\n    .pedagogical-gate .repair-stream-text { color: var(--muted); white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-size: .88rem; }\n    .pedagogical-gate .repair-stream-item { padding: 8px 0; border-top: 1px solid var(--line); }\n    .pedagogical-gate .repair-stream-item strong { display: block; margin-bottom: 4px; }\n    .pedagogical-gate .repair-stream-item span { display: block; line-height: 1.5; }\n    .pedagogical-gate .repair-stream-caret { display: inline-block; width: 7px; height: 16px; margin-left: 4px; vertical-align: middle; border-radius: 2px; background: currentColor; opacity: .55; animation: pedagogicalStreamCaret 1.4s ease-in-out infinite; }\n    @keyframes pedagogicalStreamCaret { 0%, 45% { opacity: .15; } 50%, 100% { opacity: .65; } }",
    "streaming repair styles"
  );

  replaceOnce(
    "src/js/pedagogical-gate.js",
    "const repair = await requestRepair(mode, result);",
    "const repair = await requestRepair(mode, result, gate);",
    "streaming repair invocation"
  );
}

apply();
