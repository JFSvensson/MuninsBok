import { describe, expect, it } from "vitest";
import { AppError } from "../utils/app-error.js";
import { BankAdapterError } from "./bank-adapter.js";
import { BankSyncService } from "./bank-sync.js";
import { createMockBankAdapter, createMockRepos } from "../test/helpers.js";
import type { IAggregatorBankAdapter } from "./bank-adapter.js";
import type { Repositories } from "../repositories.js";

function validConnection(overrides?: Record<string, unknown>) {
  return {
    id: "bc-1",
    organizationId: "org-1",
    provider: "sandbox",
    externalConnectionId: "ext-1",
    displayName: "Sandboxkonto",
    accountName: "Testkonto",
    accountIban: undefined,
    accountLast4: undefined,
    currency: "SEK",
    status: "CONNECTED" as const,
    authExpiresAt: new Date("2026-01-02T00:00:00.000Z"),
    lastSyncedAt: undefined,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
    metadata: {
      auth: {
        accessToken: "sbx_at_abc",
        refreshToken: "sbx_rt_abc",
        expiresAt: "2026-01-02T00:00:00.000Z",
        tokenType: "Bearer",
      },
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("BankSyncService", () => {
  it("syncs paginated transactions and marks sync run as success", async () => {
    const repos = createMockRepos();
    const adapter = createMockBankAdapter();

    repos.bankConnections.findById.mockResolvedValue(validConnection());
    repos.bankSyncRuns.create.mockResolvedValue({ id: "run-1" });
    repos.bankSyncRuns.complete.mockResolvedValue({ id: "run-1" });
    repos.bankConnections.update.mockResolvedValue({ ok: true, value: validConnection() });

    adapter.fetchTransactions
      .mockResolvedValueOnce({
        transactions: [
          {
            externalTransactionId: "tx-1",
            bookedAt: new Date("2026-01-01T00:00:00.000Z"),
            description: "Kortköp",
            amountOre: -2500,
            currency: "SEK",
          },
          {
            externalTransactionId: "tx-2",
            bookedAt: new Date("2026-01-02T00:00:00.000Z"),
            description: "Inbetalning",
            amountOre: 10000,
            currency: "SEK",
          },
        ],
        nextCursor: "2026-01-02T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        transactions: [
          {
            externalTransactionId: "tx-3",
            bookedAt: new Date("2026-01-03T00:00:00.000Z"),
            description: "Kortköp",
            amountOre: -4900,
            currency: "SEK",
          },
        ],
      });

    repos.bankTransactions.upsertMany
      .mockResolvedValueOnce({ ok: true, value: { created: 1, updated: 1 } })
      .mockResolvedValueOnce({ ok: true, value: { created: 1, updated: 0 } });

    const service = new BankSyncService({
      repos: repos as unknown as Pick<
        Repositories,
        "bankConnections" | "bankTransactions" | "bankSyncRuns" | "bankWebhookEvents"
      >,
      adapter: adapter as unknown as IAggregatorBankAdapter,
    });
    const result = await service.syncConnection({
      organizationId: "org-1",
      connectionId: "bc-1",
      trigger: "MANUAL",
      pageSize: 50,
    });

    expect(result.syncRunId).toBe("run-1");
    expect(result.fetched).toBe(3);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(1);

    expect(repos.bankSyncRuns.complete).toHaveBeenCalledWith(
      "run-1",
      "org-1",
      expect.objectContaining({
        status: "SUCCEEDED",
        importedCount: 2,
        updatedCount: 1,
      }),
    );
  });

  it("refreshes token when expired before sync", async () => {
    const repos = createMockRepos();
    const adapter = createMockBankAdapter();

    repos.bankConnections.findById.mockResolvedValue(
      validConnection({
        metadata: {
          auth: {
            accessToken: "sbx_at_expired",
            refreshToken: "sbx_rt_abc",
            expiresAt: "2020-01-01T00:00:00.000Z",
            tokenType: "Bearer",
          },
        },
      }),
    );
    repos.bankSyncRuns.create.mockResolvedValue({ id: "run-2" });
    repos.bankSyncRuns.complete.mockResolvedValue({ id: "run-2" });
    repos.bankConnections.update.mockResolvedValue({ ok: true, value: validConnection() });
    repos.bankTransactions.upsertMany.mockResolvedValue({
      ok: true,
      value: { created: 0, updated: 0 },
    });

    adapter.refreshAccessToken.mockResolvedValue({
      accessToken: "sbx_at_new",
      refreshToken: "sbx_rt_abc",
      expiresAt: new Date("2026-01-03T00:00:00.000Z"),
      tokenType: "Bearer",
      scope: ["accounts", "transactions"],
    });
    adapter.fetchTransactions.mockResolvedValue({ transactions: [] });

    const service = new BankSyncService({
      repos: repos as unknown as Pick<
        Repositories,
        "bankConnections" | "bankTransactions" | "bankSyncRuns" | "bankWebhookEvents"
      >,
      adapter: adapter as unknown as IAggregatorBankAdapter,
    });
    await service.syncConnection({ organizationId: "org-1", connectionId: "bc-1" });

    expect(adapter.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(repos.bankConnections.update).toHaveBeenCalledWith(
      "bc-1",
      "org-1",
      expect.objectContaining({
        status: "CONNECTED",
        authExpiresAt: expect.any(Date),
      }),
    );
  });

  it("marks sync as failed and maps adapter error", async () => {
    const repos = createMockRepos();
    const adapter = createMockBankAdapter();

    repos.bankConnections.findById.mockResolvedValue(validConnection());
    repos.bankSyncRuns.create.mockResolvedValue({ id: "run-3" });
    repos.bankSyncRuns.complete.mockResolvedValue({ id: "run-3" });
    repos.bankConnections.update.mockResolvedValue({ ok: true, value: validConnection() });

    adapter.fetchTransactions.mockRejectedValue(
      new BankAdapterError("ADAPTER_TEMPORARY", "Provider tillfälligt nere"),
    );

    const service = new BankSyncService({
      repos: repos as unknown as Pick<
        Repositories,
        "bankConnections" | "bankTransactions" | "bankSyncRuns" | "bankWebhookEvents"
      >,
      adapter: adapter as unknown as IAggregatorBankAdapter,
    });

    await expect(
      service.syncConnection({ organizationId: "org-1", connectionId: "bc-1" }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "ADAPTER_TEMPORARY",
    });

    expect(repos.bankSyncRuns.complete).toHaveBeenCalledWith(
      "run-3",
      "org-1",
      expect.objectContaining({
        status: "FAILED",
        errorCode: "ADAPTER_TEMPORARY",
      }),
    );
  });

  it("throws BANK_AUTH_MISSING when connection lacks token metadata", async () => {
    const repos = createMockRepos();
    const adapter = createMockBankAdapter();

    repos.bankConnections.findById.mockResolvedValue(validConnection({ metadata: {} }));

    const service = new BankSyncService({
      repos: repos as unknown as Pick<
        Repositories,
        "bankConnections" | "bankTransactions" | "bankSyncRuns" | "bankWebhookEvents"
      >,
      adapter: adapter as unknown as IAggregatorBankAdapter,
    });

    await expect(
      service.syncConnection({ organizationId: "org-1", connectionId: "bc-1" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BANK_AUTH_MISSING",
    } satisfies Partial<AppError>);
  });
});
