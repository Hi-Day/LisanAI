const { test, expect } = require("@playwright/test");
const { WRITTEN_ID, loginAsStudent } = require("./seed-assessment");

test.describe("Evaluation that cannot finish while the student waits", () => {
  test("the student is told the answers were received and leaves the exam", async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible({ timeout: 10_000 });

    // The server recorded the answers, then the AI evaluation failed.
    await page.route("**/api/evaluation", (route) => {
      if (!/"action":"evaluate"/.test(route.request().postData() || "")) return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"type":"error","message":"Jawaban Anda sudah diterima. Penilaian AI belum selesai dan akan diproses ulang.","answersRecorded":true}\n\n',
      });
    });

    await page.click(`.assessment-card[data-id='${WRITTEN_ID}'] .start-assessment-btn`);
    await expect(page.locator("#preExamStart")).toBeEnabled();
    await page.click("#preExamStart");
    await expect(page.locator("#studentWorkspace")).toBeVisible();
    await page.fill("#answerText", "Jawaban pertama.");
    await page.click("#saveAnswer");
    await page.fill("#answerText", "Jawaban kedua.");
    await page.click("#finishAssessment");
    await page.locator("#confirmModalOk").click();

    await expect(page.getByText("Jawaban Anda sudah diterima.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Gagal menyimpan hasil")).toHaveCount(0);
    await expect(page.locator("#studentWorkspace")).toBeHidden();
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible();
  });
});
