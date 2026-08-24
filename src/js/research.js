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

function approveRun(runId, humanScore, humanFeedback) {
  return fetchJson("/api/research", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", payload: { runId, humanScore, humanFeedback } }),
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
      return;
    }
    if (e.target.id === "approveAiScoreBtn") {
      const runId = els.researchResultPanel.dataset.runId;
      const scoreInput = els.researchResultPanel.querySelector("#humanScoreInput")?.value;
      const feedback = els.researchResultPanel.querySelector("#humanScoreFeedback")?.value || "";
      if (!runId) return;
      try {
        let humanScore;
        if (scoreInput !== undefined && String(scoreInput).trim() !== "") {
          humanScore = Number(scoreInput);
          if (!Number.isFinite(humanScore) || humanScore < 0 || humanScore > 100) {
            throw new Error("Skor koreksi harus angka 0-100, atau kosongkan untuk pakai skor AI");
          }
        }
        await approveRun(runId, humanScore, feedback);
        showToast(humanScore === undefined ? "Skor AI di-approve" : "Skor disetujui dengan koreksi", "success");
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

/**
 * Format a weight (0-1) as a percentage WITHOUT destructive rounding, so the
 * displayed weights always sum correctly. E.g. 0.125 -> "12.5", 0.3333 -> "33.3".
 */
function fmtWeightPct(weight) {
  const pct = (Number(weight) || 0) * 100;
  if (Number.isInteger(pct)) return String(pct);
  return pct.toFixed(1).replace(/\.0$/, "");
}

/** Turn a slug criterionId like "ketepatan_konsep_arsitektur_30" into readable text. */
function prettifyId(id) {
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{2,3}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderMetrics(els, data) {
  const m = data && data.metrics;
  const total = data && data.n ? data.n : 0;
  if (!m) {
    els.researchValidity.innerHTML =
      '<p class="empty-state">Belum ada pasangan AI-vs-Human. Beri skor manusia pada sebuah trace untuk melihat metrik validitas.</p>';
    els.researchInterRater.innerHTML =
      '<p class="empty-state">Belum ada pasangan skor untuk metrik reliabilitas.</p>';
    return;
  }
  const card = (label, value, pct, hint) => `
    <div class="metric-card" style="display:flex;flex-direction:column;justify-content:space-between;" title="${escapeHtml(hint || "")}">
      <span style="font-size:0.85rem;color:var(--muted);font-weight:500;">${label}</span>
      <strong style="font-size:1.4rem;font-weight:700;margin:8px 0;">${pct ? fmt(value * 100, 1) + "%" : fmt(value)}</strong>
      <span class="metric-hint" style="font-size:0.72rem;color:var(--muted);line-height:1.35;">${escapeHtml(hint || "")}</span>
    </div>`;
  els.researchValidity.innerHTML =
    `<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">${total} pasangan AI vs human</p>` +
    card("Pearson", m.validity.pearson, false, "Koefisien korelasi linier antara skor AI dan skor manusia. Nilai mendekati 1 menandakan keselarasan yang kuat; mendekati 0 menandakan tidak ada korelasi.") +
    card("Spearman", m.validity.spearman, false, "Korelasi berbasis peringkat yang lebih tahan terhadap nilai ekstrem dibandingkan Pearson, mengukur konsistensi urutan antar-penilai.") +
    card("MAE", m.validity.mae, false, "Rata-rata absolut selisih antara skor AI dan skor manusia. Semakin rendah (idealnya di bawah 5) semakin akurat prediksi AI.") +
    card("RMSE", m.validity.rmse, false, "Akar rata-rata kuadrat selisih skor. Memberi bobot lebih besar pada selisih yang besar sehingga sensitif terhadap anomali penilaian.") +
    card("Exact agreement", m.reliability.exactAgreement, true, "Proporsi penilaian di mana skor AI dan skor manusia bernilai identik.") +
    card("Adjacent (+/-5)", m.reliability.adjacentAgreement, true, "Proporsi penilaian dengan selisih skor maksimal 5 poin antara AI dan manusia.");

  // Inter-rater reliability (PRD §33): κ, weighted κ, ICC.
  const ir = data.interRater;
  if (els.researchInterRater) {
    if (!ir || (ir.icc == null && ir.cohensKappa == null && ir.weightedKappa == null)) {
      els.researchInterRater.innerHTML =
        '<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">' + total + ' pasangan skor</p>' +
        '<p class="empty-state">Metrik reliabilitas belum tersedia (butuh variasi skor).</p>';
    } else {
      const irCard = (label, value, hint) => `
        <div class="metric-card" style="display:flex;flex-direction:column;justify-content:space-between;" title="${escapeHtml(hint || "")}">
          <span style="font-size:0.85rem;color:var(--muted);font-weight:500;">${label}</span>
          <strong style="font-size:1.4rem;font-weight:700;margin:8px 0;">${fmt(value)}</strong>
          <span class="metric-hint" style="font-size:0.72rem;color:var(--muted);line-height:1.35;">${escapeHtml(hint || "")}</span>
        </div>`;
      els.researchInterRater.innerHTML =
        `<p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">${ir.n ?? total} pasangan AI vs human</p>` +
        irCard("Cohen's Kappa", ir.cohensKappa, "Indeks kesepakatan antara AI dan manusia setelah dikurangi peluang kebetulan. Nilai di atas 0,6 menandakan kesepakatan yang baik.") +
        irCard("Weighted Kappa", ir.weightedKappa, "Varian Cohen's Kappa yang memperhitungkan besarnya selisih; selisih kecil dikenai penalti lebih ringan dibanding selisih besar.") +
        irCard("ICC (2-way)", ir.icc, "Konsistensi antar-penilai. Nilai mendekati 1 menandakan konsistensi tinggi; di bawah 0,5 menandakan konsistensi rendah.");
    }
  }
}

function renderRuns(els, runs) {
  els.researchRunsList.innerHTML = runs.length
    ? runs
        .map((r) => {
          const status = approvalBadge(r.approval_status, r.human_score);
          const gate = gateBadge(r.verification_status, r.verification_valid);
          const versions = [
            r.harness_version ? `harness ${r.harness_version}` : null,
            r.prompt_version ? `prompt ${r.prompt_version}` : null,
          ].filter(Boolean).join(" · ");
          return `
      <tr>
        <td>${escapeHtml(r.run_id)}</td>
        <td>${escapeHtml((r.assessment_id || "").slice(0, 20))}</td>
        <td>${escapeHtml(r.model || "-")}</td>
        <td style="font-size:0.8rem;color:var(--muted);">${versions ? escapeHtml(versions) : "—"}</td>
        <td>${r.final_score ?? "-"}</td>
        <td>${gate}</td>
        <td>${status}</td>
        <td style="white-space:nowrap;">
          <button type="button" class="secondary-button" data-trace="${escapeHtml(r.run_id)}">Trace</button>
          <button type="button" class="secondary-button" data-export-run="${escapeHtml(r.run_id)}" title="Unduh detail lengkap">📥</button>
        </td>
      </tr>`;
        })
        .join("")
    : '<tr><td colspan="8" class="empty-state">Belum ada run evaluasi.</td></tr>';

  els.researchRunsList.style.display = "";
}

/**
 * Verification gate badge (PRD FR-08): PASS | REVIEW | FAIL.
 * REVIEW means the run needs human review (low confidence).
 */
function gateBadge(status, verificationValid) {
  const s = status || (verificationValid ? "PASS" : "FAIL");
  const map = {
    PASS: { label: "PASS", cls: "badge-ok", title: "Verification gate lolos — skor dapat diterbitkan" },
    REVIEW: { label: "REVIEW", cls: "badge-warn", title: "Perlu tinjauan manusia (kepercayaan rendah)" },
    FAIL: { label: "FAIL", cls: "badge-bad", title: "Evaluasi gagal verifikasi — tidak boleh diterbitkan" },
  };
  const info = map[s] || { label: s || "-", cls: "badge-muted" };
  return `<span class="badge ${info.cls}" title="${escapeHtml(info.title || "")}">${escapeHtml(info.label)}</span>`;
}

function approvalBadge(status, humanScore) {
  const map = {
    approved: { label: "Approved", cls: "badge-ok" },
    auto_approved: { label: "Auto ✓", cls: "badge-warn", title: "Otomatis dikonfirmasi setelah 7 hari tanpa aksi" },
    approved_human_correction: { label: "Dikoreksi Manusia", cls: "badge-ok", title: "Skor diperbaiki oleh manusia — nilai manusia dipakai, bukan skor AI" },
    human_reviewed: { label: "Ditinjau Manusia", cls: "badge-ok", title: "Ditinjau/dikoreksi oleh manusia — tidak lagi memakai skor AI" },
    pending: { label: "Pending", cls: "badge-muted", title: "Menunggu tinjauan guru (jendela 7 hari)" },
    rejected: { label: "Rejected", cls: "badge-bad" },
  };
  const info = map[status] || { label: status || "-", cls: "badge-muted" };
  const hs = humanScore != null ? ` · skor ${humanScore}` : "";
  return `<span class="badge ${info.cls}" ${info.title ? `title="${escapeHtml(info.title)}"` : ""}>${escapeHtml(info.label)}</span><span style="font-size:0.8rem;color:var(--muted);">${hs}</span>`;
}

function renderRubric(els, data) {
  if (!els.researchRubricPanel) return;
  const n = data && data.n ? data.n : 0;
  const coverage = data && data.criterionCoverage ? data.criterionCoverage : 0;
  els.researchRubricPanel.innerHTML = n
    ? `
      <p>Rata-rata criterion per run: <strong>${coverage.toFixed(2)}</strong></p>
      <p class="metric-hint" style="font-size:0.75rem;color:var(--muted);margin-top:-4px;">Rata-rata jumlah aspek rubrik yang dievaluasi pada tiap run evaluasi.</p>
      <p>Total criterion rows: <strong>${data.totalCriterionRows || 0}</strong></p>
      <p class="metric-hint" style="font-size:0.75rem;color:var(--muted);margin-top:-4px;">Total seluruh penilaian aspek rubrik yang dicatat di semua run.</p>
      <p>Jumlah run: <strong>${n}</strong></p>
      <p class="metric-hint" style="font-size:0.75rem;color:var(--muted);margin-top:-4px;">Banyaknya evaluasi (run) yang pernah dijalankan oleh sistem.</p>`
    : '<p class="empty-state">Belum ada data rubric compliance.</p>';
}

// Human-readable labels + hover hints for reliability dimensions (PRD FR-10).
const reliabilityDimensionDefs = {
  evidenceGrounding: {
    label: "Grounded Evidence",
    desc: "Proporsi kriteria yang skornya didukung bukti yang benar-benar ter-ground di jawaban siswa. Semakin tinggi, makin kuat dasar penilaiannya.",
  },
  criterionCoverage: {
    label: "Cakupan Kriteria",
    desc: "Proporsi kriteria rubrik yang benar-benar dievaluasi pada run ini. Nilai 100% berarti seluruh aspek rubrik dinilai.",
  },
  rubricAlignment: {
    label: "Kesesuaian Rubrik",
    desc: "Seberapa konsisten keyakinan model (confidence) dengan sistem skor rubrik. Nilai rendah menandakan skor & keyakinan kurang selaras.",
  },
  scoreConsistency: {
    label: "Konsistensi Skor",
    desc: "Kekonsistenan skor: proporsi skor yang didukung bukti serta tidak ada anomali sel. Semakin tinggi semakin andal skornya.",
  },
  outputValidity: {
    label: "Validitas Output",
    desc: "Kesesuaian output model dengan skema yang diharapkan (struktur JSON valid). Menjamin hasil dapat diparse dan dipakai dengan aman.",
  },
};

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

    // Human-readable weighted breakdown.
    const breakdownHtml = detailRows.length
      ? `
      <ul style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px;">
        ${detailRows
          .map(
            (d) => `
          <li style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <span style="min-width:0;overflow-wrap:break-word;">${escapeHtml(d.label || prettifyId(d.criterionId))}</span>
            <span style="flex-shrink:0;color:var(--muted);font-variant-numeric:tabular-nums;">
              ${fmt(d.score, 0)} × ${fmtWeightPct(d.weight)}%
              <span style="color:var(--emerald,#4caf7d);font-weight:700;">= ${fmt(d.contribution, 2)}</span>
            </span>
          </li>`
          )
          .join("")}
      </ul>`
      : `<strong>${fmt(result.finalScore, 1)}</strong>`;

    const formulaHtml = detailRows.length
      ? `<div style="font-size:0.95rem;">${breakdownHtml}<div style="margin-top:10px;font-size:1.4rem;font-weight:700;">= ${fmt(result.finalScore, 1)}</div></div>`
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
            c.noEvidence
              ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--accent,#e0a53b);"><strong>TANPA EVIDENCE</strong> — criterion tanpa bukti jawaban (FR-03)</div>`
              : Array.isArray(c.evidence) && c.evidence.length
                ? `<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--muted);">Evidence:</span><ul style="margin:4px 0 0 18px;">${c.evidence
                    .map((ev) => {
                      const verdict = ev.grounded
                        ? `<span style="color:var(--emerald);font-size:0.75rem;"> ✓ grounded</span>`
                        : `<span style="color:var(--rose, #e0706b);font-size:0.75rem;"> ✗ tidak grounded</span>`;
                      const method = ev.groundingMethod
                        ? ` <span style="color:var(--muted);font-size:0.7rem;">(${escapeHtml(ev.groundingMethod)})</span>`
                        : "";
                      return `<li>${escapeHtml(ev.text || "")}${verdict}${method}</li>`;
                    })
                    .join("")}</ul></div>`
                : ""
          }
          ${c.rationale ? `<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--muted);">Alasan:</span> ${escapeHtml(c.rationale)}</div>` : ""}
        </div>`
        )
      .join("") || '<p class="empty-state">Tanpa criterion</p>';

    // Verification gate badge (PRD FR-08).
    const gate = gateBadge(result.verification?.status, result.verification?.valid);

    // Reliability vector (PRD FR-10).
    const reliability = result.reliability;
    const reliabilityHtml = reliability && reliability.dimensions
      ? `
        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:var(--muted);font-size:0.85rem;">Reliability sistem</span>
            <strong style="font-size:1.2rem;">${fmt(reliability.overallReliability * 100, 0)}%</strong>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
            ${Object.entries(reliability.dimensions)
              .map(([k, v]) => {
                const def = reliabilityDimensionDefs[k] || { label: prettifyId(k), desc: "" };
                return `<div class="rt-dim" style="font-size:0.8rem;" data-tip="${escapeHtml(def.desc)}" title="${escapeHtml(def.label)}">
                  <span class="rt-dim-label" style="color:var(--muted);display:block;">${escapeHtml(def.label)}</span>
                  <strong>${fmt(v * 100, 1)}%</strong>
                </div>`;
              })
              .join("")}
          </div>
          <p class="hint" style="font-size:0.7rem;color:var(--muted);margin-top:8px;">Pisah dari kepercayaan model: indicator keandalan keputusan (FR-10). Arahkan kursor ke tiap dimensi untuk penjelasan.</p>
        </div>`
      : "";

    els.researchResultPanel.dataset.runId = runId;
    els.researchResultPanel.innerHTML = `
      <div class="result-modal-content">
        <button type="button" class="result-close-btn research-close-btn">&times;</button>
        <p class="eyebrow">${escapeHtml(runId)}</p>
        <h3>Trace Evaluasi</h3>
        <p>Assessment: <strong>${escapeHtml(result.assessmentId || "-")}</strong> · Verification gate: ${gate}</p>

        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <span style="color:var(--muted);font-size:0.85rem;">Skor akhir (deterministik)</span>
          <div style="font-size:1.6rem;font-weight:700;">${formulaHtml}</div>
        </div>

        ${reliabilityHtml}
        <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
          <label>Skor manusia
            <input id="humanScoreInput" type="number" min="0" max="100" placeholder="Tilai manual 0-100" />
          </label>
          <label>Penilai
            <input id="humanReviewer" type="text" value="${escapeHtml((ctx.auth && ctx.auth.user && ctx.auth.user.name) || "")}" disabled />
          </label>
          <label>Ulasan
            <textarea id="humanScoreFeedback" rows="2" placeholder="Catatan penilai manusia (opsional)"></textarea>
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button class="primary-button" id="approveAiScoreBtn" type="button">✓ Approve skor AI</button>
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
            Model: <strong>${escapeHtml(versions.model_version || result.versioning?.modelVersion || "-")}</strong> ·
            Prompt <strong>${escapeHtml(versions.prompt_version || result.versioning?.promptVersion || "-")}</strong> ·
            Rubric <strong>${escapeHtml(versions.rubric_version || result.versioning?.rubricVersion || "-")}</strong> ·
            Harness <strong>${escapeHtml(versions.harness_version || result.versioning?.harnessVersion || "-")}</strong> ·
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
    a.download = `lisanai-research-${assessmentId || "all"}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, "error");
  }
}