import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const API_BASE = "http://127.0.0.1:3000/api";

function luhnCheckDigit(base9: string): string {
  let sum = 0;
  for (let i = 0; i < base9.length; i++) {
    const digit = Number(base9[i]);
    const factor = i % 2 === 0 ? 2 : 1;
    const product = digit * factor;
    sum += product > 9 ? product - 9 : product;
  }
  return String((10 - (sum % 10)) % 10);
}

function generateOrgNumber(): string {
  const suffix = String(Date.now() % 1_000_000).padStart(6, "0");
  const base9 = `559${suffix}`;
  return `${base9}${luhnCheckDigit(base9)}`;
}

async function authedPost(
  request: APIRequestContext,
  path: string,
  accessToken: string,
  data: unknown,
) {
  return request.post(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
  });
}

test.describe("Banking e2e", () => {
  test("sync -> create voucher from transaction -> status confirmed", async ({ page, request }) => {
    const auth = await loginViaUI(page, request);

    const createOrgResp = await authedPost(request, "/organizations", auth.accessToken, {
      orgNumber: generateOrgNumber(),
      name: `E2E Banking Org ${Date.now()}`,
    });
    expect(createOrgResp.ok()).toBeTruthy();
    const createOrgBody = await createOrgResp.json();
    const orgId = String(createOrgBody.data.id);

    const externalConnectionId = `ext-${Date.now()}`;
    const callbackResp = await authedPost(
      request,
      `/organizations/${orgId}/bank/connect/callback`,
      auth.accessToken,
      {
        code: `sandbox-code-${Date.now()}`,
        externalConnectionId,
        redirectUri: "http://127.0.0.1:5173/bank/callback",
        displayName: "Sandboxkonto E2E",
      },
    );
    expect(callbackResp.status()).toBe(201);
    const callbackBody = await callbackResp.json();
    const connectionId = String(callbackBody.data.id);

    const syncResp = await authedPost(
      request,
      `/organizations/${orgId}/bank/${connectionId}/sync`,
      auth.accessToken,
      {},
    );
    expect(syncResp.ok()).toBeTruthy();

    await page.goto(`/bank/${connectionId}/transactions`);
    await expect(page.getByRole("heading", { name: "Transaktioner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skapa verifikat" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Skapa verifikat" }).first().click();

    const modal = page.locator(".card", { hasText: "Skapa verifikat från transaktion" }).first();
    await expect(modal).toBeVisible();

    await modal.getByLabel("Bankkonto").fill("1930");
    await modal.getByLabel("Motkonto").fill("6071");
    await modal.getByLabel("Beskrivning").fill("E2E verifikat från banktransaktion");
    await modal.getByRole("button", { name: "Skapa verifikat" }).click();

    await expect(page.getByText(/skapades och transaktionen bekräftades/i)).toBeVisible();
    await expect(page.getByText("Bekräftad").first()).toBeVisible();
  });
});
