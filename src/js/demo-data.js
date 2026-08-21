import { clearDatabase, saveAssessmentToDatabase } from "./api.js";
import { createDemoAssessment } from "./assessment-factory.js";
import { generateFallbackQuestions } from "./fallback-assessment.js";
import { showToast } from "./toast.js";
import { renderCurrentState, refreshSimulatorIfEnabled } from "./app-context.js";

/**
 * Demo data utilities: seed demo assessment and reset all data.
 */
export function bindDemoDataEvents(ctx) {
  const { els } = ctx;

  els.seedDemo.addEventListener("click", () => {
    if (ctx.state.assessments.length) return;
    const firstClass = ctx.state.classes[0];
    if (!firstClass) {
      showToast("Buat kelas terlebih dahulu sebelum mengisi data contoh.");
      return;
    }
    const assessment = createDemoAssessment(generateFallbackQuestions);
    assessment.classId = firstClass.id;
    saveAssessmentToDatabase(assessment)
      .then(async () => {
        ctx.state.assessments.push(assessment);
        await renderCurrentState(ctx);
      })
      .catch((error) => showToast(`Gagal menyimpan contoh data: ${error.message}`));
  });

  els.resetData.addEventListener("click", async () => {
    if (!confirm("Reset semua penilaian dan hasil?")) return;
    await clearDatabase();
    ctx.state.assessments = [];
    ctx.state.submissions = [];
    ctx.session.ensureAssessmentSelected();
    await renderCurrentState(ctx);
    await refreshSimulatorIfEnabled(ctx);
  });
}