const { test, expect } = require("@playwright/test");
const { TABLE_ID, loginAsStudent } = require("./seed-assessment");

test.describe("Tables in questions", () => {
  test("a student sees the table of a question as a real table", async ({ page }) => {
    await loginAsStudent(page);
    await page.click(`.assessment-card[data-id='${TABLE_ID}'] .start-assessment-btn`);
    await page.click("#preExamStart");
    await expect(page.locator("#studentWorkspace")).toBeVisible();

    // The wording stays in the heading, without table syntax.
    await expect(page.locator("#activeQuestion")).toContainText("Perhatikan data penjualan berikut.");
    await expect(page.locator("#activeQuestion")).toContainText("Jelaskan mengapa penjualan menurun.");
    await expect(page.locator("#activeQuestion")).not.toContainText("|");

    const table = page.locator("#activeQuestionTables table");
    await expect(table).toBeVisible();
    await expect(table.locator("thead th")).toHaveText(["Bulan", "Penjualan (unit)"]);
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table.locator("tbody tr").nth(1).locator("td")).toHaveText(["Februari", "95"]);

    // The next question has no table: the previous one must not linger.
    await page.fill("#answerText", "Penjualan menurun karena permintaan musiman turun setelah Januari.");
    await page.click("#saveAnswer");
    await expect(page.locator("#activeQuestion")).toContainText("Mengapa cahaya penting?");
    await expect(page.locator("#activeQuestionTables table")).toHaveCount(0);
  });

  test("a lecturer inserts a table into a question and sees its preview", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.guru@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });

    await page.click("#mainNav button[data-view='assessmentListView']");
    const item = page.locator(".assessment-item").filter({ hasText: "Ujian Tulis E2E" }).first();
    await item.locator(".edit-assessment").click();

    const card = page.locator(".editable-question").first();
    await expect(card).toBeVisible();
    await card.locator(".insert-table").click();
    const prompt = card.locator("textarea[data-field='prompt']");
    await expect(prompt).toHaveValue(/Apa itu fotosintesis\?\n\n\| Kolom 1 \| Kolom 2 \| Kolom 3 \|/);
    await expect(card.locator(".question-table-preview thead th")).toHaveText(["Kolom 1", "Kolom 2", "Kolom 3"]);

    // The first header cell is selected, so typing replaces it and the preview follows.
    await page.keyboard.type("Zat");
    await expect(card.locator(".question-table-preview thead th").first()).toHaveText("Zat");
  });
});
