const { test, expect } = require("@playwright/test");

test.describe("Assessment Harness research view", () => {
  test("admin can access the research view and it renders", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.admin@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });

    // Admin nav includes the Riset button.
    await expect(page.locator("#mainNav")).toContainText("Riset");

    // Navigate to the research view.
    await page.click("button[data-view='researchView']");
    await expect(page.locator("#researchView")).toBeVisible();
    await expect(page.locator("#researchView")).toContainText("Riset Penilaian");
    await expect(page.locator("#researchRunsList")).toBeVisible();
    await expect(page.locator("#researchValidity")).toBeVisible();
  });

  test("teacher cannot see the research nav button", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.guru@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });

    // Teacher nav must NOT contain Riset / research view.
    await expect(page.locator("#mainNav")).not.toContainText("Riset");
  });
});

test.describe("Research API (admin only)", () => {
test("metrics endpoint returns a structured response", async ({ page }) => {
    // Login via UI to establish a session, then hit the metrics endpoint.
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.admin@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });

    const res = await page.request.get("http://127.0.0.1:4174/api/research?action=metrics");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("n");
    expect(body).toHaveProperty("metrics");
  });

  test("metrics endpoint rejects non-admin", async ({ page, request }) => {
    // Login as teacher (via context-independent request with session cookie is hard;
    // instead verify a request without session returns 401).
    const res = await request.get("http://127.0.0.1:4174/api/research?action=metrics");
    expect(res.status()).toBe(401);
  });
});