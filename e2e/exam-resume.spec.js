const { test, expect } = require("@playwright/test");
const { WRITTEN_ID, loginAsStudent } = require("./seed-assessment");

// Leaving the exam page submits it at once (anti-cheat). Resuming is only for an exam that
// could not be submitted: a crash or a dropped connection leaves the attempt open.
test.describe("Resuming an exam the browser could not submit", () => {
  test("saved and typed answers come back, on the question the student was on", async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible({ timeout: 10_000 });

    const startExam = async () => {
      await page.click(`.assessment-card[data-id='${WRITTEN_ID}'] .start-assessment-btn`);
      await expect(page.locator("#preExamStart")).toBeEnabled();
      await page.click("#preExamStart");
      await expect(page.locator("#studentWorkspace")).toBeVisible();
    };
    const draftSavedWith = (text) => page.waitForResponse((response) => {
      const body = response.request().postData() || "";
      return body.includes('"action":"save-draft"') && body.includes(text) && response.ok();
    });

    await startExam();
    await page.fill("#answerText", "Jawaban pertama yang sudah disimpan.");
    await page.click("#saveAnswer");
    await expect(page.locator("#activeQuestion")).toHaveText("Mengapa cahaya penting?");

    // Typed but not yet saved with the button: it still reaches the server.
    const typedDraft = draftSavedWith("Jawaban kedua yang baru diketik.");
    await page.fill("#answerText", "Jawaban kedua yang baru diketik.");
    await typedDraft;

    // The connection drops: the automatic submit on leaving the page never reaches the server.
    const dropSubmit = (route) => (/"action":"evaluate"/.test(route.request().postData() || "") ? route.abort() : route.continue());
    await page.route("**/api/evaluation", dropSubmit);
    page.on("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page.unroute("**/api/evaluation", dropSubmit);
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible({ timeout: 10_000 });
    await startExam();

    await expect(page.locator("#activeQuestion")).toHaveText("Mengapa cahaya penting?");
    await expect(page.locator("#answerText")).toHaveValue("Jawaban kedua yang baru diketik.");

    // Finish, so the attempt does not stay open for the specs that follow.
    await page.click("#finishAssessment");
    await page.locator("#confirmModalOk").click();
    await expect(page.locator("#resultPanel")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#resultPanel")).toContainText("Jawaban pertama yang sudah disimpan.");
  });
});
