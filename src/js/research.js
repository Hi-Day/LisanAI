import { escapeHtml } from "./utils.js";
import { showToast } from "./toast.js";

/**
 * Research view — metrics (AI vs Human), evaluation runs, trace viewer,
 * and human-score capture. Admin-only UI.
 */

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
    body: JSON.stringify({ action: "save-human-score", payload: { runId, humanScore, humanFeedback } }),
  });
}

export function bindResearchEvents(ctx) {
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
    }
  });
}

export async function loadResearch(ctx) {
  await renderResearch(ctx, "");
}

async function renderResearch(ctx, assessmentId) {
  const { els } = ctx;
  if (!els.researchSelect) return;

  // Populate the assessment select once.
  if (els.researchSelect.options.length <= 1) {
    const assessments = (ctx.state && ctx.state.assessments) || [];
    els.researchSelect.innerHTML =
      '<option value="">Semua assessment</option>' +
      assessments
        .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.topic)}</option>`)
        .join("");
  }
  els.researchSelect.value = assessmentId || "";

  const [metrics, runs, rubric] = await Promise.all([
    fetchMetrics(assessmentId).catch(() => null),
    fetchRuns(assessmentId),
    fetchRubric(assessmentId).catch(() => null),
  ]);

  renderMetrics(els, metrics);
  renderRuns(els, runs ? runs.runs || [] : []);
  renderRubric(els, rubric);
}

function fmt(v, digits = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return typeof v === "number" ? v.toFixed(digits) : String(v);
}

function renderMetrics(els, data) {
  const m = data && data.metrics;
  const total = data && data.n ? data.n : 0;
  if (!m) {
    els.researchValidity.innerHTML =
      '<p class="empty-state">Belum ada pasangan AI-vs-Human. Beri skor manusia pada sebuah trace untuk melihat metrik validitas.</p>';
    return;
  }
  const card = (label, value, pct = false) => `
    <div class="metric-card" style="display:flex;flex-direction:column;justify-content:space-between;">
      <span style="font-size:0.85rem;color:var(--muted);font-weight:500;">${label}</span>
      <strong style="font-size:1.4rem;font-weight:700;margin:8px 0;">${pct ? fmt(value * 100, 1) + "%" : fmt(value)}</strong>
    </div>`;
  els.researchValidity.innerHTML =
    `<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">${total} pasangan AI vs human</p>` +
    card("Pearson", m.validity.pearson) +
    card("Spearman", m.validity.spearman) +
    card("MAE", m.validity.mae) +
    card("RMSE", m.validity.rmse) +
    card("Exact agreement", m.reliability.exactAgreement, true) +
    card("Adjacent (+/-5)", m.reliability.adjacentAgreement, true);
}

function renderRuns(els, runs) {
  els.researchRunsList.innerHTML = runs.length
    ? runs
        .map(
          (r) => `
      <tr>
        <td>${escapeHtml(r.run_id)}</td>
        <td>${escapeHtml((r.assessment_id || "").slice(0, 20))}</td>
        <td>${escapeHtml(r.model || "-")}</td>
        <td>${r.final_score ?? "-"}</td>
        <td>${r.verification_valid ? "✓" : "✗"}</td>
        <td style="white-space:nowrap;">
          <button type="button" class="secondary-button" data-trace="${escapeHtml(r.run_id)}">Trace</button>
          <button type="button" class="secondary-button" data-export-run="${escapeHtml(r.run_id)}" title="Unduh detail lengkap">📥</button>
        </td>
      </tr>`
        )
        .join("")
    : '<tr><td colspan="6" class="empty-state">Belum ada run evaluasi.</td></tr>';
}

function renderRubric(els, data) {
  if (!els.researchRubricPanel) return;
  const n = data && data.n ? data.n : 0;
  const coverage = data && data.criterionCoverage ? data.criterionCoverage : 0;
  els.researchRubricPanel.innerHTML = n
    ? `
      <p>Rata-rata criterion per run: <strong>${coverage.toFixed(2)}</strong></p>
      <p>Total criterion rows: <strong>${data.totalCriterionRows || 0}</strong></p>
      <p>Jumlah run: <strong>${n}</strong></p>`
    : '<p class="empty-state">Belum ada data rubric compliance.</p>';
}

async function openTrace(ctx, runId) {
  const { els } = ctx;
  try {
    const trace = await fetchTrace(runId);
    const result = trace.result || {};
    const criteria = Array.isArray(result.criteria) ? result.criteria : [];
    const versions = trace.versions || {};
    const weighted = result.weighted || {};
    const formula = weighted.formula || "";
    const events = trace.events || [];

    // Weighted formula presentation.
    const formulaHtml = formula
      ? `<code>${escapeHtml(formula)} = <strong>${fmt(result.finalScore, 1)}</strong></code>`
      : `<strong>${fmt(result.finalScore, 1)}</strong>`;

    const criteriaHtml = criteria
      .map(
        (c) => `
        <div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(c.criterionId)}</strong>
            <span style="font-weight:700;font-size:1.1rem;">${fmt(c.score, 0)}<span style="color:var(--muted);font-size:0.8rem;">/100</span></span>
          </div>
          ${typeof c.confidence === "number" ? `<div style="font-size:0.8rem;color:var(--muted);margin-top:2px;">Kepercayaan: ${fmt(c.confidence * 100, 0)}%</div>` : ""}
          ${
            Array.isArray(c.evidence) && c.evidence.length
              ? `<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--muted);">Evidence:</span><ul style="margin:4px 0 0 18px;">${c.evidence
                  .map((ev) => `<li>${escapeHtml(ev.text || "")}</li>`)
                  .join("")}</ul></div>`
              : ""
          }
          ${c.rationale ? `<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--muted);">Alasan:</span> ${escapeHtml(c.rationale)}</div>` : ""}
        </div>`
        )
        .join("") || '<p class="empty-state">Tanpa criterion</p>';

    els.researchResultPanel.dataset.runId = runId;
    els.researchResultPanel.innerHTML = `
      <div class="result-modal-content">
        <button type="button" class="result-close-btn research-close-btn">&times;</button>
        <p class="eyebrow">${escapeHtml(runId)}</p>
        <h3>Trace Evaluasi</h3>
        <p>Assessment: <strong>${escapeHtml(result.assessmentId || "-")}</strong></p>

        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <span style="color:var(--muted);font-size:0.85rem;">Skor akhir (deterministik)</span>
          <div style="font-size:1.6rem;font-weight:700;">${formulaHtml}</div>
        </div>

        <h4>Criterion, evidence &amp; kepercayaan</h4>
        ${criteriaHtml}

        <h4>Skor manusia</h4>
        <div class="form-row-2" style="margin-bottom:8px;">
          <label>Skor (0-100)
            <input id="humanScoreInput" type="number" min="0" max="100" placeholder="0-100" />
          </label>
          <label>Reviewer
            <input id="humanReviewer" type="text" value="${escapeHtml((ctx.auth && ctx.auth.user && ctx.auth.user.name) || "")}" disabled />
          </label>
        </div>
        <label>Ulasan
          <textarea id="humanScoreFeedback" rows="2" placeholder="Catatan penilai manusia (opsional)"></textarea>
        </label>
        <button class="primary-button" id="saveHumanScoreBtn" type="button">Simpan skor manusia</button>

        <details style="margin-top:16px;">
          <summary style="cursor:pointer;font-weight:600;">Teknis, versi &amp; events (detail lengkap)</summary>
          <p style="font-size:0.85rem;color:var(--muted);margin-top:8px;">
            Model: <strong>${escapeHtml(versions.model_version || result.versioning?.modelVersion || "-")}</strong> ·
            Prompt <strong>${escapeHtml(versions.prompt_version || result.versioning?.promptVersion || "-")}</strong> ·
            Rubric <strong>${escapeHtml(versions.rubric_version || result.versioning?.rubricVersion || "-")}</strong> ·
            Harness <strong>${escapeHtml(versions.harness_version || result.versioning?.harnessVersion || "-")}</strong> ·
            Engine <strong>${escapeHtml(versions.engine_version || result.versioning?.engineVersion || "-")}</strong>
          </p>
          <pre class="ai-stream-content">${escapeHtml(JSON.stringify(events, null, 2))}</pre>
        </details>
      </div>`;
    els.researchResultPanel.querySelector("#humanScoreInput").value = "";
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
    a.download = `lisanai-research-${assessmentId || "all"}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, "error");
  }
}