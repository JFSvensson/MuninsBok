import { describe, expect, it } from "vitest";
import { AppError } from "../utils/app-error.js";
import {
  BankAdapterError,
  toBankAdapterAppError,
  toBankAdapterResultError,
} from "./bank-adapter.js";
import { SandboxAggregatorBankAdapter } from "./bank-adapter.sandbox.js";

describe("SandboxAggregatorBankAdapter", () => {
  it("creates authorization URL with required OAuth params", async () => {
    const adapter = new SandboxAggregatorBankAdapter();
    const result = await adapter.createAuthorizationUrl({
      organizationId: "org-1",
      connectionExternalId: "conn-123",
      redirectUri: "https://app.local/callback",
      state: "state-abc",
    });

    expect(result.authorizationUrl).toContain("response_type=code");
    expect(result.authorizationUrl).toContain("redirect_uri=");
    expect(result.authorizationUrl).toContain("state=state-abc");
    expect(result.authorizationUrl).toContain("connection_id=conn-123");
    expect(result.state).toBe("state-abc");
  });

  it("exchanges authorization code into token set", async () => {
    const adapter = new SandboxAggregatorBankAdapter();
    const tokens = await adapter.exchangeAuthorizationCode({
      code: "sandbox-code-123",
      redirectUri: "https://app.local/callback",
    });

    expect(tokens.accessToken.startsWith("sbx_at_")).toBe(true);
    expect(tokens.refreshToken?.startsWith("sbx_rt_")).toBe(true);
    expect(tokens.tokenType).toBe("Bearer");
    expect(tokens.scope).toEqual(["accounts", "transactions"]);
  });

  it("refreshes access token from valid refresh token", async () => {
    const adapter = new SandboxAggregatorBankAdapter();
    const tokens = await adapter.refreshAccessToken("sbx_rt_abc");

    expect(tokens.accessToken.startsWith("sbx_at_")).toBe(true);
    expect(tokens.refreshToken).toBe("sbx_rt_abc");
  });

  it("fetches normalized transaction page", async () => {
    const adapter = new SandboxAggregatorBankAdapter();
    const result = await adapter.fetchTransactions({
      externalConnectionId: "conn-123",
      accessToken: "sbx_at_abc",
      fromDate: new Date("2026-01-01T00:00:00.000Z"),
      toDate: new Date("2026-01-20T00:00:00.000Z"),
      pageSize: 5,
    });

    expect(result.transactions).toHaveLength(5);
    expect(result.transactions[0]?.externalTransactionId).toContain("conn-123");
    expect(typeof result.transactions[0]?.amountOre).toBe("number");
    expect(result.nextCursor).toBeDefined();
  });

  it("throws adapter error for invalid auth code", async () => {
    const adapter = new SandboxAggregatorBankAdapter();

    await expect(
      adapter.exchangeAuthorizationCode({
        code: "bad-code",
        redirectUri: "https://app.local/callback",
      }),
    ).rejects.toMatchObject({
      code: "ADAPTER_INVALID_REQUEST",
    });
  });
});

describe("bank adapter error mapping", () => {
  it("maps adapter errors to AppError with status codes", () => {
    const mapped = toBankAdapterAppError(
      new BankAdapterError("ADAPTER_RATE_LIMITED", "Too many requests"),
    );

    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.statusCode).toBe(429);
    expect(mapped.code).toBe("ADAPTER_RATE_LIMITED");
  });

  it("maps unknown errors to internal app error", () => {
    const mapped = toBankAdapterAppError(new Error("boom"));
    expect(mapped.statusCode).toBe(500);
    expect(mapped.code).toBe("INTERNAL_ERROR");
  });

  it("maps to Result-friendly retry metadata", () => {
    const resultErr = toBankAdapterResultError(
      new BankAdapterError("ADAPTER_TEMPORARY", "Temporary provider outage"),
    );

    expect(resultErr.code).toBe("ADAPTER_TEMPORARY");
    expect(resultErr.retryable).toBe(true);
  });
});
