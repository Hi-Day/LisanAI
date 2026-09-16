import { renderApp, renderStudentHistory } from "./render.js";
import { isAssessmentLocked } from "./app-context.js";

/**
 * Render-only state refresh for the student runtime.
 *
 * This module deliberately depends only on shared rendering primitives and
 * student-safe feature modules. It must not route through app-context's
 * teacher/admin rendering path, because that path may load privileged feature
 * chunks dynamically.
 */
export function renderStudentState(ctx) {
  const { els, auth, session, state } = ctx;

  if (!auth?.user || auth.user.role !== "student") return;

  if (
    session.currentAssessmentId &&
    !state.assessments.some((assessment) => assessment.id === session.currentAssessmentId)
  ) {
    session.currentAssessmentId = null;
  }

  const currentAssessment = session.getCurrentAssessment();
  if (currentAssessment && isAssessmentLocked(ctx, currentAssessment)) {
    session.currentAssessmentId = null;
    session.currentAnswers = [];
    session.currentQuestionIndex = 0;
  }

  renderApp(els, state, session);
  renderStudentHistory(els, state.submissions, auth.user.name);

  ctx.features?.studentClassManagement?.renderStudentClasses(ctx);
  ctx.features?.studentComplaints?.notifyStudentComplaintStatus(ctx);

  if (els.studentName) {
    els.studentName.value = auth.user.name;
    els.studentName.readOnly = true;
  }

  if (session.getCurrentAssessment()?.oralExamEnabled === false) {
    ctx.recorder.setEnabled(false);
  }
}
