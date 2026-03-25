import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { IAggregatorBankAdapter } from "../services/bank-adapter.js";
import { BankAdapterError } from "../services/bank-adapter.js";

describe("Bank routes", () => {
  type AppInstance = Awaited<ReturnType<typeof buildTestApp>>["app"];
  let app: AppInstance;
  let repos: MockRepos;
  let bankAdapter: {
    [K in keyof IAggregatorBankAdapter]: IAggregatorBankAdapter[K] extends (
      ...args: infer _A
    ) => infer _R
      ? ReturnType<typeof import("vitest").vi.fn>
      : IAggregatorBankAdapter[K];
  };

  const orgId = "org-1";
  const connectionId = "conn-1";
  const oldEnabledOrgIds = process.env["BANK_ENABLED_ORG_IDS"];

  const mockConnection = {
    id: connectionId,
    organizationId: orgId,
    provider: "sandbox",
    externalConnectionId: "ext-conn-1",
    displayName: "Testbanken",
    currency: "SEK",
    status: "CONNECTED" as const,
    authExpiresAt: new Date("2026-12-31T23:59:59Z"),
    metadata: {
      auth: {
        accessToken: "sbx_at_test",
        refreshToken: "sbx_rt_test",
        expiresAt: new Date("2026-12-31T23:59:59Z").toISOString(),
        tokenType: "Bearer",
        scope: ["transactions"],
      },
    },
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const mockSyncRun = {
    id: "run-1",
    organizationId: orgId,
    connectionId,
    trigger: "MANUAL" as const,
    status: "RUNNING" as const,
    startedAt: new Date("2026-03-19"),
    importedCount: 0,
    updatedCount: 0,
    failedCount: 0,
    createdAt: new Date("2026-03-19"),
    updatedAt: new Date("2026-03-19"),
  };

  beforeEach(async () => {
    if (oldEnabledOrgIds == null) {
      delete process.env["BANK_ENABLED_ORG_IDS"];
    } else {
      process.env["BANK_ENABLED_ORG_IDS"] = oldEnabledOrgIds;
    }

    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bankAdapter = ctx.bankAdapter as any;
  });

  // ── POST /connect/init ──────────────────────────────────────────────────────

  describe("POST /:orgId/bank/connect/init", () => {
    it("returns authorization URL from adapter", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/init`,
        payload: {
          externalConnectionId: "ext-conn-1",
          redirectUri: "https://app.example.com/bank/callback",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.authorizationUrl).toContain("sandbox.aggregator.local");
      expect(bankAdapter.createAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          connectionExternalId: "ext-conn-1",
          redirectUri: "https://app.example.com/bank/callback",
        }),
      );
    });

    it("returns 400 on missing externalConnectionId", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/init`,
        payload: { redirectUri: "https://app.example.com/bank/callback" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on invalid redirectUri", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/init`,
        payload: { externalConnectionId: "ext-1", redirectUri: "not-a-url" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /connect/callback ──────────────────────────────────────────────────

  describe("POST /:orgId/bank/connect/callback", () => {
    const callbackPayload = {
      code: "sandbox-code-abc",
      externalConnectionId: "ext-conn-1",
      redirectUri: "https://app.example.com/bank/callback",
      displayName: "Testbanken",
    };

    it("creates connection and returns 201 without metadata", async () => {
      repos.bankConnections.create.mockResolvedValue({
        ok: true,
        value: mockConnection,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/callback`,
        payload: callbackPayload,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(connectionId);
      // Auth metadata must not be included in response
      expect(body.data.metadata).toBeUndefined();
      expect(repos.bankConnections.create).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          provider: "sandbox",
          externalConnectionId: "ext-conn-1",
          displayName: "Testbanken",
          status: "CONNECTED",
        }),
      );
    });

    it("returns 409 on duplicate connection", async () => {
      repos.bankConnections.create.mockResolvedValue({
        ok: false,
        error: { code: "DUPLICATE_CONNECTION", message: "Anslutning finns redan" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/callback`,
        payload: callbackPayload,
      });

      expect(res.statusCode).toBe(409);
    });

    it("returns 400 on missing code", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/callback`,
        payload: {
          externalConnectionId: "ext-conn-1",
          redirectUri: "https://app.example.com/bank/callback",
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /connections ────────────────────────────────────────────────────────

  describe("GET /:orgId/bank/connections", () => {
    it("returns connections without metadata", async () => {
      repos.bankConnections.findByOrganization.mockResolvedValue([mockConnection]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/connections`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(connectionId);
      // Auth metadata must not be included
      expect(body.data[0].metadata).toBeUndefined();
    });

    it("returns empty array when no connections", async () => {
      repos.bankConnections.findByOrganization.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/connections`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(0);
    });

    it("returns 403 when banking is disabled for organization", async () => {
      process.env["BANK_ENABLED_ORG_IDS"] = "org-2";

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/connections`,
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).code).toBe("BANKING_DISABLED");
    });
  });

  // ── GET /:connectionId/transactions ────────────────────────────────────────

  describe("GET /:orgId/bank/:connectionId/transactions", () => {
    const paginatedResult = {
      data: [
        {
          id: "tx-1",
          organizationId: orgId,
          connectionId,
          providerTransactionId: "sbx_tx_1",
          bookedAt: new Date("2026-03-01"),
          description: "ICA",
          amountOre: -12000,
          currency: "SEK",
          matchStatus: "PENDING_MATCH" as const,
          createdAt: new Date("2026-03-01"),
          updatedAt: new Date("2026-03-01"),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    it("returns paginated transactions", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankTransactions.findByConnectionPaginated.mockResolvedValue(paginatedResult);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/transactions`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(1);
      expect(body.data[0].id).toBe("tx-1");
      expect(repos.bankTransactions.findByConnectionPaginated).toHaveBeenCalledWith(
        connectionId,
        orgId,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it("returns 404 when connection not found", async () => {
      repos.bankConnections.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/transactions`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("passes pagination query params", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankTransactions.findByConnectionPaginated.mockResolvedValue({
        ...paginatedResult,
        page: 2,
        limit: 10,
      });

      await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/transactions?page=2&limit=10`,
      });

      expect(repos.bankTransactions.findByConnectionPaginated).toHaveBeenCalledWith(
        connectionId,
        orgId,
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ── POST /:connectionId/sync ────────────────────────────────────────────────

  describe("POST /:orgId/bank/:connectionId/sync", () => {
    beforeEach(() => {
      // Set up mocks for a successful sync with no transactions
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.create.mockResolvedValue(mockSyncRun);
      bankAdapter.fetchTransactions.mockResolvedValue({ transactions: [] });
      repos.bankSyncRuns.complete.mockResolvedValue({
        ...mockSyncRun,
        status: "SUCCEEDED" as const,
      });
      repos.bankConnections.update.mockResolvedValue({
        ok: true,
        value: mockConnection,
      });
    });

    it("runs a manual sync and returns result", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync`,
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.syncRunId).toBe("run-1");
      expect(body.data.fetched).toBe(0);
      expect(body.data.created).toBe(0);
      expect(body.data.updated).toBe(0);
      expect(repos.bankSyncRuns.create).toHaveBeenCalledWith(
        orgId,
        connectionId,
        expect.objectContaining({ trigger: "MANUAL" }),
      );
    });

    it("returns 404 when connection not found", async () => {
      repos.bankConnections.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync`,
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 on invalid pageSize", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync`,
        payload: { pageSize: 0 },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST/GET /webhooks ─────────────────────────────────────────────────────

  describe("POST /:orgId/bank/webhooks", () => {
    const oldWebhookSecret = process.env["BANK_WEBHOOK_HMAC_SECRET"];
    const oldSandboxWebhookSecret = process.env["BANK_WEBHOOK_SANDBOX_HMAC_SECRET"];

    beforeEach(() => {
      if (oldWebhookSecret == null) {
        delete process.env["BANK_WEBHOOK_HMAC_SECRET"];
      } else {
        process.env["BANK_WEBHOOK_HMAC_SECRET"] = oldWebhookSecret;
      }

      if (oldSandboxWebhookSecret == null) {
        delete process.env["BANK_WEBHOOK_SANDBOX_HMAC_SECRET"];
      } else {
        process.env["BANK_WEBHOOK_SANDBOX_HMAC_SECRET"] = oldSandboxWebhookSecret;
      }
    });

    const webhookEvent = {
      id: "whe-1",
      organizationId: orgId,
      connectionId,
      provider: "sandbox",
      providerEventId: "evt-1",
      eventType: "transactions.updated",
      status: "RECEIVED" as const,
      signatureValidated: true,
      payload: { changed: 2 },
      receivedAt: new Date("2026-03-20T10:00:00.000Z"),
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      updatedAt: new Date("2026-03-20T10:00:00.000Z"),
    };

    it("stores webhook and triggers webhook sync for transaction events", async () => {
      repos.bankWebhookEvents.create.mockResolvedValue({ ok: true, value: webhookEvent });
      repos.bankWebhookEvents.update.mockResolvedValue({
        ...webhookEvent,
        status: "PROCESSED",
      });

      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.create.mockResolvedValue(mockSyncRun);
      bankAdapter.fetchTransactions.mockResolvedValue({ transactions: [] });
      repos.bankSyncRuns.complete.mockResolvedValue({
        ...mockSyncRun,
        status: "SUCCEEDED" as const,
      });
      repos.bankConnections.update.mockResolvedValue({ ok: true, value: mockConnection });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        payload: {
          provider: "sandbox",
          providerEventId: "evt-1",
          eventType: "transactions.updated",
          connectionId,
          signatureValidated: true,
          payload: { changed: 2 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.eventId).toBe("whe-1");
      expect(body.data.processed).toBe(true);
      expect(repos.bankWebhookEvents.update).toHaveBeenCalledWith(
        "whe-1",
        orgId,
        expect.objectContaining({ status: "PROCESSED" }),
      );
      expect(repos.bankSyncRuns.create).toHaveBeenCalledWith(
        orgId,
        connectionId,
        expect.objectContaining({ trigger: "WEBHOOK" }),
      );
    });

    it("is idempotent for duplicate provider events", async () => {
      repos.bankWebhookEvents.create.mockResolvedValue({
        ok: false,
        error: {
          code: "DUPLICATE_PROVIDER_EVENT",
          message: "Webhook-event finns redan registrerat",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        payload: {
          provider: "sandbox",
          providerEventId: "evt-dup",
          eventType: "transactions.updated",
          connectionId,
          payload: { changed: 0 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.duplicate).toBe(true);
      expect(repos.bankSyncRuns.create).not.toHaveBeenCalled();
    });

    it("returns 400 when webhook payload is invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        payload: {
          provider: "sandbox",
          eventType: "transactions.updated",
          payload: { changed: 0 },
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("validates webhook HMAC signature when secret is configured", async () => {
      process.env["BANK_WEBHOOK_HMAC_SECRET"] = "super-secret";
      const payload = { changed: 2 };
      const signature = createHmac("sha256", "super-secret")
        .update(JSON.stringify(payload))
        .digest("hex");

      repos.bankWebhookEvents.create.mockResolvedValue({ ok: true, value: webhookEvent });
      repos.bankWebhookEvents.update.mockResolvedValue({
        ...webhookEvent,
        status: "PROCESSED",
      });
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.create.mockResolvedValue(mockSyncRun);
      bankAdapter.fetchTransactions.mockResolvedValue({ transactions: [] });
      repos.bankSyncRuns.complete.mockResolvedValue({
        ...mockSyncRun,
        status: "SUCCEEDED" as const,
      });
      repos.bankConnections.update.mockResolvedValue({ ok: true, value: mockConnection });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        headers: { "x-webhook-signature": `sha256=${signature}` },
        payload: {
          provider: "sandbox",
          providerEventId: "evt-signed",
          eventType: "transactions.updated",
          connectionId,
          payload,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(repos.bankWebhookEvents.create).toHaveBeenCalledWith(
        expect.objectContaining({ signatureValidated: true }),
      );
    });

    it("returns 400 when webhook signature is missing and secret is configured", async () => {
      process.env["BANK_WEBHOOK_HMAC_SECRET"] = "super-secret";

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        payload: {
          provider: "sandbox",
          providerEventId: "evt-missing-sig",
          eventType: "transactions.updated",
          connectionId,
          payload: { changed: 2 },
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).code).toBe("BANK_WEBHOOK_SIGNATURE_MISSING");
    });

    it("returns 400 when webhook signature is invalid and secret is configured", async () => {
      process.env["BANK_WEBHOOK_HMAC_SECRET"] = "super-secret";

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        headers: { "x-webhook-signature": "sha256=deadbeef" },
        payload: {
          provider: "sandbox",
          providerEventId: "evt-bad-sig",
          eventType: "transactions.updated",
          connectionId,
          payload: { changed: 2 },
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).code).toBe("BANK_WEBHOOK_SIGNATURE_INVALID");
    });

    it("prefers provider-specific webhook secret over global fallback", async () => {
      process.env["BANK_WEBHOOK_HMAC_SECRET"] = "global-secret";
      process.env["BANK_WEBHOOK_SANDBOX_HMAC_SECRET"] = "provider-secret";

      const payload = { changed: 1 };
      const signature = createHmac("sha256", "provider-secret")
        .update(JSON.stringify(payload))
        .digest("hex");

      repos.bankWebhookEvents.create.mockResolvedValue({ ok: true, value: webhookEvent });
      repos.bankWebhookEvents.update.mockResolvedValue({
        ...webhookEvent,
        status: "PROCESSED",
      });
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.create.mockResolvedValue(mockSyncRun);
      bankAdapter.fetchTransactions.mockResolvedValue({ transactions: [] });
      repos.bankSyncRuns.complete.mockResolvedValue({
        ...mockSyncRun,
        status: "SUCCEEDED" as const,
      });
      repos.bankConnections.update.mockResolvedValue({ ok: true, value: mockConnection });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/webhooks`,
        headers: { "x-webhook-signature": signature },
        payload: {
          provider: "sandbox",
          providerEventId: "evt-provider-secret",
          eventType: "transactions.updated",
          connectionId,
          payload,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(repos.bankWebhookEvents.create).toHaveBeenCalledWith(
        expect.objectContaining({ signatureValidated: true }),
      );
    });
  });

  describe("GET /:orgId/bank/webhooks", () => {
    it("returns recent webhook events with default limit", async () => {
      repos.bankWebhookEvents.listRecentByOrganization.mockResolvedValue([
        {
          id: "whe-1",
          organizationId: orgId,
          connectionId,
          provider: "sandbox",
          providerEventId: "evt-1",
          eventType: "transactions.updated",
          status: "PROCESSED",
          signatureValidated: true,
          payload: { changed: 2 },
          receivedAt: new Date("2026-03-20T10:00:00.000Z"),
          createdAt: new Date("2026-03-20T10:00:00.000Z"),
          updatedAt: new Date("2026-03-20T10:00:00.000Z"),
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/webhooks`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(repos.bankWebhookEvents.listRecentByOrganization).toHaveBeenCalledWith(orgId, 20);
    });

    it("respects explicit limit query", async () => {
      repos.bankWebhookEvents.listRecentByOrganization.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/webhooks?limit=5`,
      });

      expect(res.statusCode).toBe(200);
      expect(repos.bankWebhookEvents.listRecentByOrganization).toHaveBeenCalledWith(orgId, 5);
    });
  });

  // ── GET /:connectionId/sync-runs ───────────────────────────────────────────

  describe("GET /:orgId/bank/:connectionId/sync-runs", () => {
    const mockRun = {
      id: "run-1",
      organizationId: orgId,
      connectionId,
      trigger: "MANUAL" as const,
      status: "SUCCEEDED" as const,
      startedAt: new Date("2026-03-20T09:00:00.000Z"),
      completedAt: new Date("2026-03-20T09:00:05.000Z"),
      importedCount: 3,
      updatedCount: 0,
      failedCount: 0,
      createdAt: new Date("2026-03-20"),
      updatedAt: new Date("2026-03-20"),
    };

    it("returns recent sync runs with default limit", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.findLatestByConnection.mockResolvedValue([mockRun]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync-runs`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("run-1");
      expect(repos.bankSyncRuns.findLatestByConnection).toHaveBeenCalledWith(
        connectionId,
        orgId,
        10,
      );
    });

    it("respects explicit limit query", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.findLatestByConnection.mockResolvedValue([]);

      await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync-runs?limit=5`,
      });

      expect(repos.bankSyncRuns.findLatestByConnection).toHaveBeenCalledWith(
        connectionId,
        orgId,
        5,
      );
    });

    it("returns 404 when connection not found", async () => {
      repos.bankConnections.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync-runs`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /:connectionId/auth/refresh ───────────────────────────────────────

  describe("POST /:orgId/bank/:connectionId/auth/refresh", () => {
    it("refreshes token and returns updated expiry", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      bankAdapter.refreshAccessToken.mockResolvedValue({
        accessToken: "sbx_at_new",
        refreshToken: "sbx_rt_new",
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        tokenType: "Bearer",
        scope: ["transactions"],
      });
      repos.bankConnections.update.mockResolvedValue({
        ok: true,
        value: { ...mockConnection, authExpiresAt: new Date("2027-01-01T00:00:00.000Z") },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/auth/refresh`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe("CONNECTED");
      expect(body.data.connectionId).toBe(connectionId);
      expect(repos.bankConnections.update).toHaveBeenCalledWith(
        connectionId,
        orgId,
        expect.objectContaining({ status: "CONNECTED" }),
      );
    });

    it("returns 404 when connection not found", async () => {
      repos.bankConnections.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/auth/refresh`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when no refresh token in metadata", async () => {
      repos.bankConnections.findById.mockResolvedValue({
        ...mockConnection,
        metadata: {
          auth: {
            accessToken: "sbx_at_test",
            expiresAt: "2026-12-31T23:59:59Z",
            tokenType: "Bearer",
          },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/auth/refresh`,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("BANK_REFRESH_TOKEN_MISSING");
    });

    it("returns 401 and marks connection AUTH_REQUIRED when refresh token is expired", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      bankAdapter.refreshAccessToken.mockRejectedValue(
        new BankAdapterError("ADAPTER_UNAUTHORIZED", "Ogiltig refresh token"),
      );
      repos.bankConnections.updateStatus.mockResolvedValue({ ok: true, value: mockConnection });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/auth/refresh`,
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("BANK_AUTH_REQUIRED");
    });
  });

  // ── POST/GET /transactions/:transactionId/* (matching flow) ──────────────

  describe("Bank transaction matching routes", () => {
    const txId = "tx-match-1";
    const voucherId = "vch-1";

    const bankTxBase = {
      id: txId,
      organizationId: orgId,
      connectionId,
      providerTransactionId: "sbx_tx_match_1",
      bookedAt: new Date("2026-03-15T00:00:00.000Z"),
      description: "Lunch med kund",
      amountOre: -12500,
      currency: "SEK",
      matchStatus: "PENDING_MATCH" as const,
      createdAt: new Date("2026-03-15T00:00:00.000Z"),
      updatedAt: new Date("2026-03-15T00:00:00.000Z"),
    };

    const voucher = {
      id: voucherId,
      fiscalYearId: "fy-1",
      organizationId: orgId,
      number: 42,
      date: new Date("2026-03-15T00:00:00.000Z"),
      description: "Lunch med kund",
      lines: [
        {
          id: "line-1",
          voucherId,
          accountNumber: "6071",
          debit: 12500,
          credit: 0,
        },
        {
          id: "line-2",
          voucherId,
          accountNumber: "1930",
          debit: 0,
          credit: 12500,
        },
      ],
      documentIds: [],
      status: "DRAFT" as const,
      createdAt: new Date("2026-03-15T00:00:00.000Z"),
      updatedAt: new Date("2026-03-15T00:00:00.000Z"),
    };

    it("returns match candidates for transaction", async () => {
      repos.bankTransactions.findById.mockResolvedValue(bankTxBase);
      repos.vouchers.findByDateRange.mockResolvedValue([voucher]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/transactions/${txId}/match-candidates?limit=5`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].voucherId).toBe(voucherId);
    });

    it("matches transaction to voucher", async () => {
      repos.bankTransactions.findById.mockResolvedValue(bankTxBase);
      repos.vouchers.findById.mockResolvedValue(voucher);
      repos.vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(false);
      repos.bankTransactions.updateMatch.mockResolvedValue({
        ...bankTxBase,
        matchStatus: "MATCHED",
        matchedVoucherId: voucherId,
        matchConfidence: 90,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/transactions/${txId}/match`,
        payload: {
          voucherId,
          matchConfidence: 90,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(repos.bankTransactions.updateMatch).toHaveBeenCalledWith(
        txId,
        orgId,
        expect.objectContaining({ status: "MATCHED", matchedVoucherId: voucherId }),
      );
    });

    it("unmatches transaction", async () => {
      repos.bankTransactions.findById.mockResolvedValue({
        ...bankTxBase,
        matchStatus: "MATCHED",
        matchedVoucherId: voucherId,
      });
      repos.bankTransactions.updateMatch.mockResolvedValue({
        ...bankTxBase,
        matchStatus: "PENDING_MATCH",
        matchedVoucherId: null,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/transactions/${txId}/unmatch`,
      });

      expect(res.statusCode).toBe(200);
      expect(repos.bankTransactions.updateMatch).toHaveBeenCalledWith(
        txId,
        orgId,
        expect.objectContaining({ status: "PENDING_MATCH", matchedVoucherId: null }),
      );
    });

    it("returns 400 when confirming transaction without voucher match", async () => {
      repos.bankTransactions.findById.mockResolvedValue(bankTxBase);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/transactions/${txId}/confirm`,
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).code).toBe("BANK_TRANSACTION_NOT_MATCHED");
    });

    it("creates voucher from transaction and confirms match", async () => {
      repos.bankTransactions.findById.mockResolvedValue(bankTxBase);
      repos.fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: orgId,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-12-31T00:00:00.000Z"),
          isClosed: false,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      repos.vouchers.create.mockResolvedValue({ ok: true, value: voucher });
      repos.bankTransactions.updateMatch.mockResolvedValue({
        ...bankTxBase,
        matchStatus: "CONFIRMED",
        matchedVoucherId: voucherId,
        matchConfidence: 100,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/transactions/${txId}/create-voucher`,
        payload: {
          bankAccountNumber: "1930",
          counterAccountNumber: "6071",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(repos.vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          description: expect.stringContaining("Banktransaktion:"),
          lines: [
            expect.objectContaining({ accountNumber: "6071", debit: 12500, credit: 0 }),
            expect.objectContaining({ accountNumber: "1930", debit: 0, credit: 12500 }),
          ],
        }),
      );
      expect(repos.bankTransactions.updateMatch).toHaveBeenCalledWith(
        txId,
        orgId,
        expect.objectContaining({ status: "CONFIRMED", matchedVoucherId: voucherId }),
      );
    });
  });
});
