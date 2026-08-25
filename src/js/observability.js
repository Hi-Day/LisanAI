import { renderObservability } from "./render.js";
import { showToast } from "./toast.js";
import { setButtonLoading } from "./dom.js";

/**
 * Observability dashboard (PRD Observability & Research Redesign v1.0).
 *
 * Loads telemetry with an optional time range + log filters, prevents
 * duplicate concurrent refreshes, shows a loading state, and exposes the
 * "last updated" timestamp.
 */

let telemetryRequestSeq = 0;
const LOG_PAGE_SIZE = 10;
let telemetryLogOffset = 0;

export function bindObservabilityEvents(ctx) {
  const { els } = ctx;

  // Observability tab switching
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

  // Log filters reset to page 0 and reload the log table (with the current range).
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

export async function loadTelemetry(ctx) {
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
  setButtonLoading(els.refreshTelemetryBtn, active, "Memuat…", "🔄 Refresh Telemetry");
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