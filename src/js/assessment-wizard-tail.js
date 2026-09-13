import { streamAssessmentAction } from "./api.js";
import { generateFallbackQuestions, recommendFallbackConfig } from "./fallback-assessment.js";
import { showToast } from "./toast.js";
import { compactText, escapeHtml, formatTime } from "./utils.js";
import { renderRubricTable } from "./render.js";

export function renderReviewSummary(ctx) {
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
      <ol class="review-questions">${ctx.pendingQuestions.map((q, i) => `<li class="${(q.prompt || "").trim() ? "" : "review-empty"}"><strong>Soal ${i + 1}</strong><span>${escapeHtml(compactText(q.prompt || "Belum diisi", 120))}</span>${q.probing ? `<span class="review-probing-badge">⚡ probing aktif</span>` : ""}</li>`).join("")}</ol>
    </div>`;
}

function parseRubricNames(text) {
  if (!text) return [];
  const t = String(text).trim();
  if (t.startsWith("{")) { try { const p = JSON.parse(t); if (p.version === "2" && Array.isArray(p.criteria)) return p.criteria.map((c) => c.name || "").filter(Boolean); } catch {} }
  return t.split(/[;\n,]+/).map((s) => s.replace(/^\d+(\.\d+)?\s*%?\s*/, "").replace(/\s*[-:–]\s*(\d+(\.\d+)?\s*%?)?$/, "").replace(/\s*\(?\d+(\.\d+)?\s*%?\s*\)?$/, "").trim()).filter((s) => s.length > 2);
}
function normalizeCoverageKey(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function renderAlignmentCoverage(ctx) {
  const questions = ctx.pendingQuestions || [];
  const covered = new Set(questions.flatMap((q) => Array.isArray(q.criteria) ? q.criteria.map((c) => normalizeCoverageKey(typeof c === "string" ? c : c.name || c.id)) : []));
  const expected = [...new Set(questions.flatMap((q) => parseRubricNames(q.rubric)))];
  const uncovered = expected.filter((name) => !covered.has(normalizeCoverageKey(name)));
  if (!uncovered.length) return "";
  return `<p class="review-align-warning">⚠ Kriteria rubrik berikut belum diukur oleh soal manapun: <strong>${uncovered.map(escapeHtml).join("; ")}</strong>.</p>`;
}

export function goToWizardStep(ctx, step) {
  const { els } = ctx;
  ctx.currentWizardStep = step;
  els.wizardPanels.forEach((panel) => panel.classList.toggle("hidden", Number(panel.dataset.wizardPanel) !== step));
  els.wizardSteps.forEach((btn) => { const active = Number(btn.dataset.wizardStep) === step; btn.classList.toggle("active", active); btn.setAttribute("aria-selected", String(active)); btn.disabled = Number(btn.dataset.wizardStep) > step; });
  if (step === 3) renderReviewSummary(ctx);
}
export async function handleRecommendConfig(ctx) { await fillRecommendedFields(ctx, "both"); }
export async function fillRecommendedFields(ctx, target) {
  const { els } = ctx; const topic = els.topic.value.trim();
  if (!topic) { showToast("Isi topik atau materi terlebih dahulu."); els.topic.focus(); return; }
  const button = els.recommendOutcomes; const defaultText = "Rekomendasikan kompetensi";
  try { button && (button.disabled = true); showRecommendStreamPlaceholder(ctx); const recommendation = await recommendConfigWithFallback(ctx, topic, els.difficulty.value); if (recommendation && (target === "outcomes" || target === "both")) els.outcomes.value = recommendation.outcomes || ""; hideStreamPanel(ctx, els.recommendStreamPanel); }
  finally { if (button) button.disabled = false; }
}
export async function recommendConfigWithFallback(ctx, topic, difficulty) {
  let raw = ""; let recommendation = null;
  try { await streamAssessmentAction({ action: "recommend-assessment-config", payload: { topic, difficulty }, onChunk: (text) => { raw += text; renderRecommendStream(ctx, raw); }, onResult: (data) => { recommendation = data?.recommendation || null; } }); return recommendation || recommendFallbackConfig(topic, difficulty); }
  catch (error) { showToast(`AI belum tersedia, memakai rekomendasi lokal. Detail: ${error.message}`); return recommendFallbackConfig(topic, difficulty); }
}
function showRecommendStreamPlaceholder(ctx) { const { els } = ctx; els.recommendStreamPlaceholder?.classList.remove("hidden"); if (els.recommendStreamContent) els.recommendStreamContent.textContent = ""; els.recommendStreamPanel?.classList.remove("hidden"); ctx.recommendStreamShown = {}; }
function renderRecommendStream(ctx, raw) { const { els } = ctx; if (!els.recommendStreamContent) return; els.recommendStreamPlaceholder?.classList.add("hidden"); const value = extractStreamedField(raw, "outcomes"); ctx.recommendStreamShown = ctx.recommendStreamShown || {}; if (value !== null) ctx.recommendStreamShown.outcomes = value; if (ctx.recommendStreamShown.outcomes !== undefined) { els.recommendStreamContent.textContent = `📋 Kompetensi:\n${ctx.recommendStreamShown.outcomes}`; els.recommendStreamContent.scrollTop = els.recommendStreamContent.scrollHeight; } }
function extractStreamedField(raw, field) { const keyIdx = String(raw || "").indexOf(`"${field}"`); if (keyIdx < 0) return null; let i = keyIdx + field.length + 2; while (i < raw.length && (raw[i] === " " || raw[i] === ":")) i++; if (raw[i] !== '"') return null; i++; let out = ""; for (; i < raw.length; i++) { const ch = raw[i]; if (ch === "\\") { const n = raw[++i]; if (n === "n") out += "\n"; else if (n === '"') out += '"'; else if (n === "\\") out += "\\"; else out += n || ""; } else if (ch === '"') break; else out += ch; } return out; }

export async function generateQuestionsWithFallback(ctx, config) {
  let raw = ""; let questions = null;
  try { await streamAssessmentAction({ action: "generate-questions", payload: config, onChunk: (text) => { raw += text; renderStreamedQuestionsFromRaw(ctx, raw); }, onResult: (data) => { questions = Array.isArray(data?.questions) ? data.questions : null; } }); return questions; }
  catch (error) { showToast(`AI belum tersedia, memakai generator lokal. Detail: ${error.message}`); return generateFallbackQuestions(config); }
}
function renderStreamedQuestionsFromRaw(ctx, raw) { const { els } = ctx; if (!els.aiStreamQuestions) return; els.aiStreamPlaceholder?.classList.add("hidden"); const trimmed = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim(); const match = trimmed.match(/\{[\s\S]*\}/); if (!match) return; try { const parsed = JSON.parse(match[0]); (Array.isArray(parsed.questions) ? parsed.questions : []).forEach((q, i) => renderStreamedQuestion(ctx, i, q)); } catch {} }
export async function improveQuestionsWithFallback(ctx, config, questions) { let raw = ""; let improved = null; try { await streamAssessmentAction({ action: "improve-questions", payload: { config, questions }, onChunk: (text) => { raw += text; renderStreamedQuestionsFromRaw(ctx, raw); }, onResult: (data) => { improved = Array.isArray(data?.questions) ? data.questions : null; } }); return improved || questions; } catch (error) { showToast(`AI belum tersedia, memakai question set sebelumnya. Detail: ${error.message}`); return questions; } }
export async function alignRubricWithFallback(ctx, config, questions) { let raw = ""; let aligned = null; try { await streamAssessmentAction({ action: "align-rubric", payload: { config, questions }, onChunk: (text) => { raw += text; renderStreamedQuestionsFromRaw(ctx, raw); }, onResult: (data) => { aligned = Array.isArray(data?.questions) ? data.questions : null; } }); return aligned || questions; } catch (error) { showToast(`AI belum tersedia, memakai alignment deterministik. Detail: ${error.message}`); return questions; } }
export function hideStreamPanel(ctx, panel) { panel?.classList.add("hidden"); }
export function showQuestionStreamPlaceholder(ctx) { const { els } = ctx; els.aiStreamPlaceholder?.classList.remove("hidden"); if (els.aiStreamQuestions) els.aiStreamQuestions.innerHTML = ""; els.aiStreamPanel?.classList.remove("hidden"); els.aiStreamPanel?.classList.remove("ai-stream-done"); }
function hideQuestionStreamPlaceholder(ctx) { ctx.els.aiStreamPlaceholder?.classList.add("hidden"); }
function renderStreamedQuestion(ctx, index, question) { const { els } = ctx; const prompt = String(question?.prompt || "").trim(); if (!els.aiStreamQuestions || !prompt) return; let card = els.aiStreamQuestions.querySelector(`[data-q-index="${index}"]`); if (!card) { card = document.createElement("div"); card.dataset.qIndex = index; els.aiStreamQuestions.appendChild(card); } card.className = "ai-stream-question"; card.innerHTML = `<span class="ai-q-num">${index + 1}</span><span class="ai-q-text">${escapeHtml(prompt)}</span>`; }
export function finishQuestionStream(ctx) { const { els } = ctx; els.aiStreamPanel?.classList.add("ai-stream-done"); const first = els.aiStreamQuestions?.querySelector(".ai-stream-question"); if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); first.classList.add("ai-stream-focus"); } }

const DEFAULT_LEVELS = [
  { score: 4, label: "Sangat Baik", descriptor: "" }, { score: 3, label: "Baik", descriptor: "" }, { score: 2, label: "Cukup", descriptor: "" }, { score: 1, label: "Kurang", descriptor: "" },
];
function fillLevelDescriptors(name, levels) { const templates = [`${name || "Kriteria"} sangat baik, lengkap, dan tepat`, `${name || "Kriteria"} baik dan memadai`, `${name || "Kriteria"} cukup, namun masih perlu pengembangan`, `${name || "Kriteria"} kurang, perlu perbaikan signifikan`]; return levels.map((l, i) => ({ ...l, descriptor: l.descriptor || templates[i] || "" })); }
export function parseRubricToCriteria(text) {
  if (!text || !String(text).trim()) return [{ id: "c1", name: "", weight: 0, levels: fillLevelDescriptors("", structuredClone(DEFAULT_LEVELS)) }];
  const t = String(text).trim();
  if (t.startsWith("{")) { try { const p = JSON.parse(t); if (p.version === "2" && Array.isArray(p.criteria)) return p.criteria.map((c, i) => ({ id: c.id || `c${i + 1}`, name: c.name || "", weight: c.weight || 0, levels: fillLevelDescriptors(c.name || "", Array.isArray(c.levels) && c.levels.length === 4 ? c.levels : structuredClone(DEFAULT_LEVELS)) })); } catch {} }
  const lines = []; let depth = 0; let start = 0;
  for (let i = 0; i < t.length; i++) { if (["(","[","{"].includes(t[i])) depth++; else if ([")","]","}"].includes(t[i])) depth--; else if (depth === 0 && [",",";","\n"].includes(t[i])) { const seg = t.slice(start, i).trim(); if (seg) lines.push(seg); start = i + 1; } }
  const last = t.slice(start).trim(); if (last) lines.push(last); if (!lines.length) lines.push("");
  return lines.map((line, i) => { let name = line.replace(/^[•\-*]\s*/, "").replace(/[.!]+$/, "").trim(); name = name.replace(/,\s*(?=\d+\s*%?$)/, " ").trim(); let weight = 0; let m = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/); if (m) { name = m[1].trim(); weight = Number(m[2]); } else { m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/); if (m) { weight = Number(m[1]); name = m[2].trim(); } } return { id: `c${i + 1}`, name, weight, levels: fillLevelDescriptors(name, structuredClone(DEFAULT_LEVELS)) }; });
}
function formatCriteriaToJson(criteria) { return JSON.stringify({ version: "2", criteria }); }
export function renderRubrikBuilder(el, rubricText) {
  const criteria = parseRubricToCriteria(rubricText); const levels = criteria[0]?.levels || DEFAULT_LEVELS; el.dataset.ready = "1";
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong style="font-size:0.9rem;">Rubrik dengan Gradasi</strong><button type="button" class="secondary-button rubrik-add" style="padding:4px 12px;font-size:0.85rem;">+ Tambah Kriteria</button></div><div class="rubrik-gradation-wrap"><table class="rubrik-gradation"><thead><tr><th style="min-width:140px;">Kriteria</th><th style="min-width:40px;">Bobot</th>${levels.map((l) => `<th class="rubrik-level-${l.score}">${escapeHtml(l.label)} (${l.score})</th>`).join("")}<th style="width:32px;"></th></tr></thead><tbody class="rubrik-rows">${criteria.map((c, i) => rubrikGradationRow(c, i, levels)).join("")}</tbody></table></div><div class="rubrik-weight-sum" data-sum></div>`;
  el.querySelector(".rubrik-add")?.addEventListener("click", () => { const tbody = el.querySelector(".rubrik-rows"); const idx = tbody.children.length; const row = document.createElement("tr"); row.innerHTML = rubrikGradationRow({ id: `c${idx + 1}`, name: "", weight: 0, levels: structuredClone(DEFAULT_LEVELS) }, idx, levels); tbody.appendChild(row); updateRubrik(el); });
  el.querySelector(".rubrik-rows")?.addEventListener("input", () => updateRubrik(el));
  el.querySelector(".rubrik-rows")?.addEventListener("click", (e) => { if (e.target.closest(".rubrik-delete")) { e.target.closest("tr").remove(); updateRubrik(el); } });
  updateRubrik(el);
}
function rubrikGradationRow(c, idx, levels) { return `<tr class="rubrik-row"><td><input type="text" class="rubrik-name" placeholder="Nama kriteria" value="${escapeHtml(c.name || "")}" style="width:100%;" /></td><td><input type="number" class="rubrik-weight" min="0" max="100" step="1" value="${c.weight}" aria-label="Bobot %" style="width:50px;" />%</td>${levels.map((l, li) => `<td class="rubrik-level-cell rubrik-level-${l.score}"><textarea class="rubrik-desc" rows="2" placeholder="Deskripsi ${l.label.toLowerCase()}..." aria-label="${escapeHtml(l.label)}">${escapeHtml(c.levels?.[li]?.descriptor || "")}</textarea></td>`).join("")}<td><button type="button" class="action-button danger-button rubrik-delete" aria-label="Hapus">&times;</button></td></tr>`; }
function updateRubrik(el) { const rows = [...el.querySelectorAll(".rubrik-rows tr")]; const criteria = rows.map((r, i) => ({ id: `c${i + 1}`, name: r.querySelector(".rubrik-name")?.value.trim() || "", weight: Number(r.querySelector(".rubrik-weight")?.value || 0), levels: DEFAULT_LEVELS.map((l, li) => ({ score: l.score, label: l.label, descriptor: r.querySelectorAll(".rubrik-desc")[li]?.value?.trim() || "" })) })); const sum = criteria.reduce((a, c) => a + (Number.isFinite(c.weight) ? c.weight : 0), 0); const sumEl = el.querySelector("[data-sum]"); if (sumEl) { sumEl.textContent = `Total bobot: ${sum}% ${sum === 100 ? "✓" : sum > 100 ? "(kelebihan)" : "(kurang)"}`; sumEl.className = `rubrik-weight-sum ${sum === 100 ? "valid" : "invalid"}`; } const bridge = window.__lisanAssessmentWizardBridge; const qIndex = el.dataset.qIndex; if (bridge?.ctx && qIndex !== undefined && bridge.ctx.pendingQuestions[qIndex]) bridge.ctx.pendingQuestions[qIndex].rubric = formatCriteriaToJson(criteria); }
export function convertLegacyRubricToJson(text) { if (!text || !String(text).trim()) return ""; const t = String(text).trim(); if (t.startsWith("{")) return t; try { return formatCriteriaToJson(parseRubricToCriteria(t)); } catch { return t; } }
