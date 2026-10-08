import { postJson } from "./api.js";
import { escapeHtml } from "./utils.js";
import { showToast } from "./toast.js";

async function requestJson(url) {
  const response = await fetch(url, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Gagal memuat data");
  return data;
}

function ensureResearchLab() {
  const view = document.getElementById("researchView");
  if (!view) return null;
  let panel = document.getElementById("researchLabPanel");
  if (panel) return panel;

  if (!document.getElementById("researchLabStyles")) {
    const style = document.createElement("style");
    style.id = "researchLabStyles";
    style.textContent = `
      #researchLabPanel { margin: 24px 0; border: 1px solid var(--border, var(--line)); border-radius: 18px; padding: 22px; background: var(--panel, var(--card)); }
      #researchLabPanel .lab-eyebrow { color: var(--muted); text-transform: uppercase; letter-spacing: .08em; font-size: .72rem; font-weight: 700; }
      #researchLabPanel .lab-title-row { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px; }
      #researchLabPanel h3 { margin: 5px 0 8px; font-size: 1.25rem; }
      #researchLabPanel p { color: var(--muted); line-height: 1.5; }
      #researchLabPanel .lab-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin:20px 0 16px; }
      #researchLabPanel label { display:flex; flex-direction:column; gap:7px; font-size:.86rem; font-weight:600; }
      #researchLabPanel select, #researchLabPanel input { width:100%; min-height:42px; padding:9px 11px; border:1px solid var(--border,var(--line)); border-radius:10px; background:var(--surface,var(--panel)); color:inherit; }
      #researchLabPanel .lab-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
      #researchLabPanel .lab-note { font-size:.8rem; margin-top:12px; }
      #researchLabPanel .lab-results { margin-top:22px; }
      #researchLabPanel .lab-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-top:12px; }
      #researchLabPanel .lab-card { border:1px solid var(--border,var(--line)); border-radius:12px; padding:14px; min-width:0; }
      #researchLabPanel .lab-card small { color:var(--muted); display:block; margin-bottom:7px; }
      #researchLabPanel .lab-card strong { font-size:1.25rem; overflow-wrap:anywhere; }
      #researchLabPanel .lab-badge { display:inline-flex; border-radius:999px; padding:5px 9px; background:var(--surface,var(--panel)); border:1px solid var(--border,var(--line)); font-size:.78rem; font-weight:700; }
      #researchLabPanel .lab-status { margin-top:14px; padding:12px; border-radius:10px; background:var(--surface,var(--panel)); }
      #researchLabPanel .lab-error { color:var(--danger,#b42318); }
      @media(max-width:600px) { #researchLabPanel { padding:15px; } #researchLabPanel .lab-form { grid-template-columns:1fr 1fr; } }
      @media(max-width:380px) { #researchLabPanel .lab-form { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  panel = document.createElement("section");
  panel.id = "researchLabPanel";
  panel.setAttribute("aria-labelledby", "researchLabTitle");
  panel.innerHTML = `
    <div class="lab-title-row">
      <div>
        <span class="lab-eyebrow">Experimental workspace</span>
        <h3 id="researchLabTitle">Research Lab — Baseline vs AI Harness</h3>
        <p>Jalankan eksperimen terkontrol pada dataset yang sama. Hasil hanya untuk riset; tidak mengubah nilai resmi mahasiswa.</p>
      </div>
      <span class="lab-badge">Admin only</span>
    </div>
    <form id="researchLabForm">
      <div class="lab-form">
        <label for="labDataset">Dataset
          <select id="labDataset" required><option value="">Memuat dataset…</option></select>
        </label>
        <label for="labMode">Metode evaluasi
          <select id="labMode">
            <option value="both">Compare Both (Baseline + Harness)</option>
            <option value="baseline">Single Prompt Baseline</option>
            <option value="harness">Modular AI Harness</option>
          </select>
        </label>
        <label for="labProvider">Provider
          <select id="labProvider">
            <option value="mock">Mock — deterministik, tanpa biaya API</option>
            <option value="openrouter">OpenRouter — model server</option>
          </select>
        </label>
        <label for="labSamples">Jumlah sampel
          <input id="labSamples" type="number" min="1" max="20" value="10" required />
        </label>
        <label for="labRepeats">Repeated runs per sampel
          <select id="labRepeats">
            <option value="1">1×</option><option value="2">2×</option><option value="3">3×</option>
          </select>
        </label>
      </div>
      <div class="lab-actions">
        <button type="submit" class="btn btn-primary" id="runResearchLabBtn">Jalankan eksperimen</button>
        <button type="button" class="btn btn-secondary" id="refreshResearchLabBtn">Muat ulang dataset</button>
      </div>
      <p class="lab-note">Provider/model dikendalikan dari konfigurasi server. Batas eksperimen UI: 20 sampel dan 3 pengulangan untuk menjaga biaya serta waktu eksekusi.</p>
    </form>
    <div id="researchLabStatus" class="lab-status" role="status" aria-live="polite">Pilih dataset lalu jalankan eksperimen.</div>
    <div id="researchLabResults" class="lab-results" aria-live="polite"></div>
  `;

  const heading = view.querySelector(".section-heading");
  if (heading?.nextSibling) heading.parentNode.insertBefore(panel, heading.nextSibling);
  else view.prepend(panel);
  return panel;
}

function fmt(value, digits = 3) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function card(label, value, detail = "") {
  return `<div class="lab-card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong>${detail ? `<p class="lab-note">${escapeHtml(detail)}</p>` : ""}</div>`;
}

function renderExperiment(experiment) {
  const results = document.getElementById("researchLabResults");
  const metrics = experiment.metrics || {};
  const agreement = metrics.agreement || {};
  const modes = experiment.mode || [];
  const methodBadges = modes.map((mode) => `<span class="lab-badge">${mode === "baseline" ? "Single Prompt Baseline" : "Modular AI Harness"}</span>`).join(" ");
  let html = `
    <div class="lab-title-row"><div><span class="lab-eyebrow">Experiment result</span><h3>${escapeHtml(experiment.datasetName || experiment.dataset)} · ${escapeHtml(experiment.datasetVersion || "v1")}</h3></div><div>${methodBadges}</div></div>
    <p>${experiment.sampleCount} sampel unik · ${experiment.repeats}× repeat · provider: ${escapeHtml(experiment.provider)} · model: ${escapeHtml(experiment.configuredModel)} · durasi: ${(experiment.elapsedMs / 1000).toFixed(1)} detik</p>
    <div class="lab-grid">
  `;
  for (const mode of modes) {
    const row = agreement[mode] || {};
    html += card(`${mode === "baseline" ? "Baseline" : "Harness"} · MAE`, fmt(row.mae), "Lebih rendah lebih baik; dibandingkan dengan skor manusia.");
    html += card(`${mode === "baseline" ? "Baseline" : "Harness"} · RMSE`, fmt(row.rmse), "Sensitif terhadap selisih skor yang besar.");
    html += card(`${mode === "baseline" ? "Baseline" : "Harness"} · Pearson`, fmt(row.pearson), "Korelasi skor AI dengan skor manusia.");
    html += card(`${mode === "baseline" ? "Baseline" : "Harness"} · Mean score`, fmt((metrics.means || {})[mode]), "Rata-rata skor keluaran metode.");
  }
  html += "</div>";

  const comparison = experiment.comparison;
  if (comparison) {
    const ci = comparison.confidenceInterval95 || {};
    const mae = comparison.pairedMae || {};
    html += `
      <h3 style="margin-top:24px">Perbandingan berpasangan</h3>
      <p>Delta didefinisikan sebagai Harness − Baseline. Observasi dipasangkan berdasarkan sampel yang sama; repeated runs dirata-ratakan per sampel sebelum inferensi.</p>
      <div class="lab-grid">
        ${card("n pasangan", comparison.n)}
        ${card("Mean delta", fmt(comparison.meanDelta), "Nilai positif berarti skor Harness lebih tinggi, bukan otomatis lebih akurat.")
        }
        ${card("Effect size · Cohen’s dz", fmt(comparison.effectSizeCohenDz))}
        ${card("95% CI mean delta", `[${fmt(ci.lower)}, ${fmt(ci.upper)}]`, ci.method || "")}
        ${card("Permutation p-value", fmt(comparison.permutationPValue), "Uji sign-flip berpasangan; bukan ukuran besarnya efek.")}
        ${card("MAE Baseline → Harness", `${fmt(mae.baselineMae)} → ${fmt(mae.harnessMae)}`, "Perubahan MAE berpasangan; nilai lebih rendah lebih baik.")}
      </div>
    `;
  } else {
    html += '<p class="lab-note">Untuk inferensi berpasangan dan effect size, pilih mode Compare Both.</p>';
  }
  if (experiment.validation && !experiment.validation.valid) {
    html += `<p class="lab-error">Peringatan validasi dataset: ${escapeHtml((experiment.validation.errors || []).join("; "))}</p>`;
  }
  html += '<p class="lab-note">Interpretasikan metrik bersama ukuran sampel, kualitas anotasi manusia, dan validitas dataset. Hasil eksperimen ini tidak digunakan untuk menilai atau menimpa submission mahasiswa.</p>';
  results.innerHTML = html;
}

async function loadDatasets() {
  const panel = ensureResearchLab();
  if (!panel) return;
  const select = panel.querySelector("#labDataset");
  const data = await requestJson("/api/benchmark-experiment?action=datasets");
  select.innerHTML = (data.datasets || []).map((dataset) =>
    `<option value="${escapeHtml(dataset.id)}" data-count="${dataset.sampleCount}">${escapeHtml(dataset.name)} · ${dataset.sampleCount} sampel</option>`
  ).join("");
  if (!data.datasets?.length) select.innerHTML = '<option value="">Tidak ada dataset yang valid</option>';
  const samples = panel.querySelector("#labSamples");
  samples.max = String(Math.min(20, Number(select.selectedOptions[0]?.dataset.count) || 20));
  panel.querySelector("#labProvider option[value='openrouter']").textContent =
    `OpenRouter — ${data.configuredModel || "model server"}`;
}

export function bindResearchLabEvents() {
  const panel = ensureResearchLab();
  if (!panel || panel.dataset.bound === "1") return;
  panel.dataset.bound = "1";
  const form = panel.querySelector("#researchLabForm");
  const status = panel.querySelector("#researchLabStatus");
  const runButton = panel.querySelector("#runResearchLabBtn");
  panel.querySelector("#labDataset").addEventListener("change", () => {
    const samples = panel.querySelector("#labSamples");
    samples.max = String(Math.min(20, Number(panel.querySelector("#labDataset").selectedOptions[0]?.dataset.count) || 20));
    if (Number(samples.value) > Number(samples.max)) samples.value = samples.max;
  });

  panel.querySelector("#refreshResearchLabBtn").addEventListener("click", async () => {
    try {
      status.textContent = "Memuat dataset…";
      await loadDatasets();
      status.textContent = "Dataset siap. Pilih konfigurasi lalu jalankan eksperimen.";
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("lab-error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      dataset: panel.querySelector("#labDataset").value,
      mode: panel.querySelector("#labMode").value,
      provider: panel.querySelector("#labProvider").value,
      sampleLimit: Number(panel.querySelector("#labSamples").value),
      repeats: Number(panel.querySelector("#labRepeats").value),
    };
    if (!payload.dataset) {
      status.textContent = "Pilih dataset yang valid.";
      status.classList.add("lab-error");
      return;
    }
    if (!Number.isInteger(payload.sampleLimit) || payload.sampleLimit < 1 || payload.sampleLimit > 20) {
      status.textContent = "Jumlah sampel harus antara 1 dan 20.";
      status.classList.add("lab-error");
      return;
    }

    runButton.disabled = true;
    runButton.textContent = "Eksperimen berjalan…";
    status.classList.remove("lab-error");
    status.textContent = "Eksperimen berjalan. Untuk OpenRouter, waktu dan biaya bergantung pada model serta jumlah sampel.";
    panel.querySelector("#researchLabResults").innerHTML = "";
    try {
      const response = await postJson("/api/benchmark-experiment", { action: "run", payload }, "Eksperimen gagal");
      renderExperiment(response.experiment);
      status.textContent = "Eksperimen selesai. Hasil ini bersifat riset dan tidak mengubah penilaian resmi.";
      showToast("Eksperimen Research Lab selesai", "success");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("lab-error");
      showToast(error.message, "error");
    } finally {
      runButton.disabled = false;
      runButton.textContent = "Jalankan eksperimen";
    }
  });

  loadDatasets().then(() => {
    status.textContent = "Dataset siap. Pilih konfigurasi lalu jalankan eksperimen.";
  }).catch((error) => {
    status.textContent = error.message;
    status.classList.add("lab-error");
  });
}
