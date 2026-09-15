import { closeResultModal } from "./app-context.js";

/**
 * Result modal interaction is shared by roles but intentionally isolated from
 * monitoring so students do not need to load teacher monitoring code merely to
 * close their own evaluation result.
 */
export function bindResultModalEvents(ctx) {
  const { els } = ctx;
  if (!els.resultPanel) return;

  if (els.resultPanel.dataset.resultModalBound === "true") return;
  els.resultPanel.dataset.resultModalBound = "true";

  els.resultPanel.addEventListener("click", (event) => {
    if (event.target.closest(".close-result-btn") || event.target === els.resultPanel) {
      closeResultModal(ctx);
    }
  });
}
