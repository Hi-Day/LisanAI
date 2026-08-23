const { test, expect } = require("@playwright/test");

test.describe("Teacher assessment flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.guru@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    // PRD UX v1.0: Dashboard is the teacher landing view; open the wizard
    // through the "Buat Penilaian" entry in the Penilaian nav group.
    await page.click("#mainNav .nav-sub-item[data-nav-view='teacherView']");
    await expect(page.locator("#teacherView")).toBeVisible();
  });

  test("teacher sees the assessment wizard with class options", async ({ page }) => {
    await expect(page.locator("#assessmentForm")).toBeVisible();
    // The seeded class should be available in the class select
    const classSelect = page.locator("#classSelect");
    await expect(classSelect).toContainText("Kelas E2E");
  });

  test("teacher can navigate the wizard to the questions step", async ({ page }) => {
    // Fill the context form
    await page.fill("#topic", "Fotosintesis");
    await page.fill("#outcomes", "Siswa mampu menjelaskan proses fotosintesis.");
    await page.fill("#rubric", "Akurasi 40%, Kelengkapan 60%");
    await page.selectOption("#classSelect", { label: "Kelas E2E" });

    // Click "Lanjut ke Soal"
    await page.click("#wizardToQuestions");
    // Step 2 (Soal) should be active — the "Buat manual" button should be visible
    await expect(page.locator("#createManualAssessment")).toBeVisible();
  });

  test("teacher can create a manual assessment and publish it", async ({ page }) => {
    await page.fill("#topic", "Hukum Newton");
    await page.fill("#outcomes", "Siswa mampu menerapkan hukum Newton.");
    await page.fill("#rubric", "Konsep 50%, Contoh 50%");
    await page.selectOption("#classSelect", { label: "Kelas E2E" });

    // Navigate to step 2 first
    await page.click("#wizardToQuestions");
    await expect(page.locator("#createManualAssessment")).toBeVisible();

    // Create manual assessment
    await page.click("#createManualAssessment");
    await expect(page.locator("#questionEditor")).toBeVisible();

    // Fill the first question
    const firstQuestion = page.locator(".editable-question").first();
    await firstQuestion.locator("[data-field='prompt']").fill("Jelaskan hukum Newton pertama.");
    await firstQuestion.locator("[data-field='ideal']").fill("Benda diam tetap diam jika tidak ada gaya.");

    // Go to review
    await page.click("#wizardToReview");
    await expect(page.locator("#reviewSummary")).toBeVisible();

    // Publish
    await page.click("#saveQuestionSet");
    // Should return to step 1 and the assessment should appear in the list
    await expect(page.locator("#assessmentList")).toContainText("Hukum Newton");
  });
});
