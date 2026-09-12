const { test, expect } = require("@playwright/test");
const { WRITTEN_ID } = require("./seed-assessment");

async function loginAsStudent(page) {
  await page.goto("/");
  await page.fill("#loginEmail", "e2e.siswa@example.com");
  await page.fill("#loginPassword", "password123");
  await page.click("#loginForm button[type='submit']");
  await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
}

test.describe("Student assessment flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("student sees the student dashboard with their class", async ({ page }) => {
    await expect(page.locator("#studentView")).toBeVisible();
    await expect(page.locator("#studentClassList")).toContainText("Kelas E2E");
  });

  test("student can open the history view", async ({ page }) => {
    await page.click("button[data-view='studentHistoryView']");
    await expect(page.locator("#studentHistoryView")).toBeVisible();
  });

  test("student can complete a written assessment and receive an evaluated result", async ({ page }) => {
    const card = page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`);
    await expect(card).toBeVisible();
    await card.locator(".start-assessment-btn").click();

    await expect(page.locator("#preExamModal")).toBeVisible();
    await page.click("#preExamStart");
    await expect(page.locator("#studentWorkspace")).toBeVisible();
    await expect(page.locator("#activeQuestion")).toHaveText("Apa itu fotosintesis?");

    await page.fill("#answerText", "Fotosintesis adalah proses tumbuhan mengubah energi cahaya menjadi energi kimia dalam bentuk glukosa.");
    await page.click("#saveAnswer");
    await expect(page.locator("#activeQuestion")).toHaveText("Mengapa cahaya penting?");

    await page.fill("#answerText", "Cahaya menyediakan energi untuk menjalankan reaksi fotosintesis dan pembentukan glukosa.");
    await page.click("#finishAssessment");

    await expect(page.locator("#confirmModal")).toBeVisible();
    await expect(page.locator("#confirmModalMessage")).toContainText("Semua 2 soal sudah dijawab");
    await page.click("#confirmModalOk");

    await expect(page.locator("#evaluationLoadingModal")).toBeHidden({ timeout: 30_000 });
    await expect(page.locator("#resultPanel")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#resultPanel")).toContainText("Nilai");
    await expect(page.locator("#resultPanel .close-result-btn")).toBeVisible();
  });
});
