import { test, expect } from "@playwright/test";

test.describe("Navigation & accessibility", () => {
  test("skip link is visible on Tab and targets main content", async ({ page }) => {
    await page.goto("/");
    // Press Tab to focus the skip link
    await page.keyboard.press("Tab");
    const skipLink = page.locator("a.skip-link");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toContainText("Hoppa till innehåll");
    // The link target should exist
    const target = page.locator("#main-content");
    await expect(target).toBeAttached();
  });

  test("page has proper ARIA landmarks", async ({ page }) => {
    await page.goto("/");
    // Banner role on header
    const banner = page.locator("[role='banner']");
    await expect(banner).toBeAttached();
    // Main content area
    const main = page.locator("main#main-content");
    await expect(main).toBeAttached();
  });

  test("header shows app title", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toHaveText("Munins bok");
  });
});

test.describe("API endpoint validation", () => {
  test("health check returns structured response", async ({ request }) => {
    const resp = await request.get("http://localhost:3000/health");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("database");
    expect(body).toHaveProperty("timestamp");
    expect(["ok", "degraded"]).toContain(body.status);
  });

  test("API returns 400 for dashboard without fiscalYearId", async ({ request }) => {
    const resp = await request.get(
      "http://localhost:3000/api/organizations/nonexistent/dashboard"
    );
    expect(resp.status()).toBe(400);
  });

  test("API returns 400 for reports without fiscalYearId", async ({ request }) => {
    const resp = await request.get(
      "http://localhost:3000/api/organizations/nonexistent/reports/trial-balance"
    );
    expect(resp.status()).toBe(400);
  });

  test("API returns proper error structure", async ({ request }) => {
    const resp = await request.get(
      "http://localhost:3000/api/organizations/nonexistent/vouchers"
    );
    const body = await resp.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("CORS headers are present", async ({ request }) => {
    const resp = await request.get("http://localhost:3000/health");
    const headers = resp.headers();
    // CORS should allow the configured origin
    expect(headers["access-control-allow-origin"]).toBeTruthy();
  });
});
