const { test, expect } = require("@playwright/test");

async function loginAsTeacher(page) {
  await page.goto("/");
  await page.fill("#loginEmail", "e2e.guru@example.com");
  await page.fill("#loginPassword", "password123");
  await page.click("#loginForm button[type='submit']");
  await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
  await page.click("#mainNav .nav-sub-item[data-nav-view='teacherView']");
  await expect(page.locator("#teacherView")).toBeVisible();
}

async function fillContext(page, topic, outcomes) {
  await page.fill("#topic", topic);
  await page.fill("#outcomes", outcomes);
  await page.selectOption("#classSelect", { label: "Kelas E2E" });
}

test.describe("Assessment creation workflow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  test("validates required context before entering the questions step", async ({ page }) => {
    await page.click("#wizardToQuestions");
    await expect(page.locator("#teacherView")).toBeVisible();
    await expect(page.locator("[data-wizard-panel='1']")).toBeVisible();

    await fillContext(page, "Fotosintesis", "Siswa mampu menjelaskan proses fotosintesis.");
    await page.click("#wizardToQuestions");
    await expect(page.locator("[data-wizard-panel='2']")).toBeVisible();
    await expect(page.locator("#createManualAssessment")).toBeVisible();
  });

  test("recommendation streams into the context form and fills the competency", async ({ page }) => {
    await page.fill("#topic", "Fotosintesis");
    await page.click("#recommendOutcomes");

    await expect(page.locator("#recommendStreamPanel")).toBeVisible();
    await expect(page.locator("#outcomes")).not.toHaveValue("");
    await expect(page.locator("#recommendStreamContent")).not.toHaveText("");
  });

  test("AI generation opens the refactored question editor with streamed questions", async ({ page }) => {
    await fillContext(page, "Hukum Newton", "Siswa mampu menerapkan hukum Newton dalam situasi nyata.");
    await page.fill("#questionCount", "2");
    await page.click("#wizardToQuestions");
    await expect(page.locator("#createManualAssessment")).toBeVisible();

    await page.locator("#assessmentForm").evaluate((form) => form.requestSubmit());

    await expect(page.locator("#questionEditor")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".editable-question")).toHaveCount(2);
    await expect(page.locator("#aiStreamPanel")).toBeHidden();
    await expect(page.locator("[data-wizard-panel='2']")).toBeVisible();
  });

  test("manual editor supports add/delete, rubric builder, review, and return navigation", async ({ page }) => {
    await fillContext(page, "Teks Argumentasi", "Siswa mampu menjelaskan alasan utama dalam teks argumentasi.");
    await page.fill("#questionCount", "1");
    await page.click("#wizardToQuestions");
    await page.click("#createManualAssessment");

    await expect(page.locator(".editable-question")).toHaveCount(1);
    await page.locator(".editable-question [data-field='prompt']").fill("Jelaskan alasan utama penulis.");
    await page.locator(".editable-question [data-field='outcome']").fill("Siswa mampu mengidentifikasi alasan utama.");
    await page.locator(".editable-question [data-field='ideal']").fill("Alasan utama dijelaskan dengan bukti yang relevan.");

    await page.click(".rubrik-builder-toggle");
    const builder = page.locator(".rubrik-builder-0");
    await expect(builder).toBeVisible();
    await builder.locator(".rubrik-name").fill("Ketepatan alasan");
    await builder.locator(".rubrik-weight").fill("100");
    await expect(builder.locator("[data-sum]")).toContainText("100%");

    await page.click("#addManualQuestion");
    await expect(page.locator(".editable-question")).toHaveCount(2);
    await page.locator(".editable-question").nth(1).locator("[data-field='prompt']").fill("Jelaskan bukti pendukung.");
    await page.locator(".editable-question").nth(1).locator(".delete-question").click();
    await expect(page.locator(".editable-question")).toHaveCount(1);

    await page.click("#wizardToReview");
    await expect(page.locator("#reviewSummary")).toBeVisible();
    await expect(page.locator("#reviewSummary")).toContainText("Jelaskan alasan utama penulis.");

    await page.click("#wizardBackToQuestions");
    await expect(page.locator("[data-wizard-panel='2']")).toBeVisible();
    await expect(page.locator(".editable-question")).toHaveCount(1);
  });

  test("can save the edited question set to the question bank", async ({ page }) => {
    await fillContext(page, "Ekosistem", "Siswa mampu menjelaskan hubungan antar komponen ekosistem.");
    await page.fill("#questionCount", "1");
    await page.click("#wizardToQuestions");
    await page.click("#createManualAssessment");

    await page.locator(".editable-question [data-field='prompt']").fill("Jelaskan hubungan produsen dan konsumen.");
    await page.click("#saveToBankBtn");

    await expect(page.locator("#questionBankView")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#questionBankList")).toContainText("Jelaskan hubungan produsen dan konsumen.");
  });
});
