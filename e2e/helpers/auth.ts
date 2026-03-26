/**
 * E2E auth helpers.
 *
 * Registers a fresh test user via the API, then logs in through
 * the actual login form so the browser has a fully authenticated session.
 */
import type { Page, APIRequestContext } from "@playwright/test";

const API_BASE = "http://127.0.0.1:3000";
const TEST_PASSWORD = "TestPass123!";

let counter = 0;

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

/**
 * Register a unique test user via the API and return tokens + user info.
 */
export async function registerTestUser(request: APIRequestContext): Promise<AuthResult> {
  counter++;
  const email = `e2e-${Date.now()}-${counter}@test.local`;
  const resp = await request.post(`${API_BASE}/api/auth/register`, {
    data: { email, name: "E2E Test User", password: TEST_PASSWORD },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to register test user: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  return body.data as AuthResult;
}

/**
 * Register a test user via the API, then authenticate in the browser
 * by filling in the login form. After this the page is at "/" and the
 * app is fully authenticated.
 */
export async function loginViaUI(page: Page, request: APIRequestContext): Promise<AuthResult> {
  const auth = await registerTestUser(request);

  // Go to login page and fill in credentials
  await page.goto("/login");
  await page.fill("#email", auth.user.email);
  await page.fill("#password", TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait until the app has redirected away from /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

  return auth;
}
