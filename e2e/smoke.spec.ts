import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("Smoke tests", () => {
  test("app loads and shows header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Munins bok");
  });

  test("health check endpoint returns ok", async ({ request }) => {
    const response = await request.get("http://localhost:3000/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });

  test("welcome page shows create button when no org exists", async ({ page, request }) => {
    test.slow();
    await loginViaUI(page, request);
    await expect(page.getByTitle("Ny organisation")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Skapa organisation" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("API returns 401 for vouchers without auth", async ({ request }) => {
    const response = await request.get(
      "http://localhost:3000/api/organizations/nonexistent/vouchers",
    );
    expect(response.status()).toBe(401);
  });
});
