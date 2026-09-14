const { test, expect } = require("@playwright/test");
const { WRITTEN_ID, loginAsStudent } = require("./seed-assessment");

// Run this spec only through `npm run test:e2e:openrouter`.
// The runner requires a real OPENROUTER_API_KEY and forces HARNESS_PROVIDER=openrouter.
test.describe("Student AI evaluation via OpenRouter", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible();
  });

  test("student completes an assessment and receives a real AI evaluation", async ({ page }) => {
    const evaluationResponses = [];
    const assessmentResponses = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith("/api/evaluation")) evaluationResponses.push(response);
      if (url.endsWith("/api/assessment")) assessmentResponses.push(response);
    });

    await page.click(`.assessment-card[data-id='${WRITTEN_ID}'] .start-assessment-btn`);
    await expect(page.locator("#preExamStart")).toBeEnabled();
    await page.click("#preExamStart");
    await expect(page.locator("#studentWorkspace")).toBeVisible();

    await page.fill(
      "#answerText",
      "Fotosintesis adalah proses tumbuhan membuat glukosa dari karbon dioksida dan air dengan bantuan energi cahaya."
    );
    await page.click("#saveAnswer");
    await expect(page.locator("#activeQuestion")).toHaveText("Mengapa cahaya penting?");

    await page.fill(
      "#answerText",
      "Cahaya menyediakan energi yang digunakan untuk mengubah bahan awal menjadi produk berenergi, termasuk glukosa."
    );
    await page.click("#finishAssessment");

    const confirmButton = page.locator("#confirmModalOk");
    await expect(confirmButton).toBeVisible({ timeout: 5_000 });
    await confirmButton.click();

    await expect.poll(() => evaluationResponses.length, { timeout: 90_000 }).toBeGreaterThan(0);

    const evaluationResponse = evaluationResponses.at(-1);
    expect(evaluationResponse.status()).toBe(200);
    const body = (await evaluationResponse.body()).toString("utf8");

    // SSE contract returned by /api/evaluation.
    expect(body).toContain('"type":"result"');
    expect(body).toContain('"harness":true');
    expect(body).toContain('"evaluation"');

    // Regression guard for the 403 bug: student evaluation must not call the
    // teacher/admin-only /api/assessment endpoint.
    expect(assessmentResponses.length).toBe(0);

    // Fallback must not be silently used when this suite is configured with
    // HARNESS_PROVIDER=openrouter and a real API key.
    await expect(page.locator("#resultPanel")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#resultPanel")).not.toContainText("AI sedang tidak dapat diakses");
  });
});
