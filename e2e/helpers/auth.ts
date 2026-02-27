/**
 * E2E auth helpers.
 *
 * Registers a fresh test user via the API and provides tokens
 * that can be injected into the browser (localStorage) or used
 * as Authorization headers for API-level tests.
 */
import type { Page, APIRequestContext } from "@playwright/test";

const API_BASE = "http://localhost:3000";

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
    data: { email, name: "E2E Test User", password: "TestPass123!" },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to register test user: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  return body.data as AuthResult;
}

/**
 * Inject auth tokens into the browser so the app considers the user logged in.
 *
 * The app stores the refresh token in localStorage under `muninsbok_refresh_token`.
 * On page load the AuthContext will use it to obtain a fresh access token.
 */
export async function loginViaStorage(page: Page, request: APIRequestContext): Promise<AuthResult> {
  const auth = await registerTestUser(request);

  // Set the refresh token in localStorage before navigating
  await page.addInitScript((refreshToken: string) => {
    localStorage.setItem("muninsbok_refresh_token", refreshToken);
  }, auth.refreshToken);

  return auth;
}
