import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { BankTransactionMatchStatus } from "@muninsbok/core/types";
import { AppError } from "../utils/app-error.js";
import { parseBody } from "../utils/parse-body.js";
import { BankAdapterError } from "../services/bank-adapter.js";
import { createBankTransactionMatchingService } from "../services/bank-matching.js";
import {
  bankConnectInitSchema,
  bankConnectCallbackSchema,
  bankMatchCandidatesQuerySchema,
  bankSyncBodySchema,
  bankTransactionConfirmSchema,
  bankTransactionCreateVoucherSchema,
  bankTransactionMatchSchema,
  bankWebhookCreateSchema,
  bankWebhookListQuerySchema,
  bankSyncRunListQuerySchema,
  bankBulkConfirmSchema,
  bankBulkUnmatchSchema,
} from "../schemas/index.js";

function hmacSha256Hex(payload: unknown, secret: string): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  return trimmed.startsWith("sha256=") ? trimmed.slice(7) : trimmed;
}

function signaturesMatch(provided: string, expected: string): boolean {
  if (!/^[a-f0-9]+$/i.test(provided) || provided.length !== expected.length) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function resolveWebhookSecret(provider: string): string | undefined {
  const normalizedProvider = provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return (
    process.env[`BANK_WEBHOOK_${normalizedProvider}_HMAC_SECRET`] ??
    process.env["BANK_WEBHOOK_HMAC_SECRET"]
  );
}

function isBankingEnabledForOrganization(organizationId: string): boolean {
  const raw = process.env["BANK_ENABLED_ORG_IDS"];
  if (raw == null || raw.trim() === "") {
    return true;
  }

  const normalized = raw.trim();
  if (normalized === "*") {
    return true;
  }

  const allowedIds = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedIds.includes(organizationId);
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface OauthStatePayload {
  orgId: string;
  externalConnectionId: string;
  redirectUri: string;
  exp: number;
  nonce: string;
}

function normalizeRedirectUri(redirectUri: string): string {
  return new URL(redirectUri).toString();
}

function resolveAllowedRedirectUris(): Set<string> {
  const explicitAllowlist = process.env["BANK_OAUTH_REDIRECT_URI_ALLOWLIST"]?.trim();
  if (explicitAllowlist) {
    return new Set(
      explicitAllowlist
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(normalizeRedirectUri),
    );
  }

  const defaults = new Set<string>([
    "http://127.0.0.1:5173/bank/callback",
    "http://localhost:5173/bank/callback",
  ]);

  const corsOrigin = process.env["CORS_ORIGIN"]?.trim();
  if (corsOrigin) {
    defaults.add(new URL("/bank/callback", corsOrigin).toString());
  }

  return defaults;
}

function createSignedOauthState(payload: OauthStatePayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${signature}`;
}

function parseSignedOauthState(state: string, secret: string): OauthStatePayload | undefined {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return;
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("hex");
  if (!signaturesMatch(signature, expectedSignature)) {
    return;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<OauthStatePayload>;

    if (
      typeof parsed.orgId !== "string" ||
      typeof parsed.externalConnectionId !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.nonce !== "string"
    ) {
      return;
    }

    return {
      orgId: parsed.orgId,
      externalConnectionId: parsed.externalConnectionId,
      redirectUri: parsed.redirectUri,
      exp: parsed.exp,
      nonce: parsed.nonce,
    };
  } catch {
    return;
  }
}

export async function bankRoutes(fastify: FastifyInstance) {
  const adapter = fastify.bankAdapter;
  const bankSync = fastify.bankSync;
  const bankMatching = createBankTransactionMatchingService({
    repos: fastify.repos,
  });
  const allowedRedirectUris = resolveAllowedRedirectUris();

  fastify.addHook("preHandler", async (request, reply) => {
    const orgId = (request.params as Record<string, string | undefined>)["orgId"];
    if (!orgId) {
      return;
    }

    if (!isBankingEnabledForOrganization(orgId)) {
      return reply.status(403).send({
        error: "Bankfunktioner är inte aktiverade för organisationen",
        code: "BANKING_DISABLED",
      });
    }
  });

  // POST /:orgId/bank/connect/init — generate OAuth authorization URL
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/bank/connect/init",
    async (request, reply) => {
      const body = parseBody(bankConnectInitSchema, request.body);
      const redirectUri = normalizeRedirectUri(body.redirectUri);
      if (!allowedRedirectUris.has(redirectUri)) {
        return reply.status(400).send({
          error: "Redirect URI är inte tillåten",
          code: "BANK_OAUTH_INVALID_REDIRECT_URI",
        });
      }

      const state = createSignedOauthState(
        {
          orgId: request.params.orgId,
          externalConnectionId: body.externalConnectionId,
          redirectUri,
          exp: Date.now() + OAUTH_STATE_TTL_MS,
          nonce: randomUUID(),
        },
        fastify.bankAuthStateSecret,
      );
      const result = await adapter.createAuthorizationUrl({
        organizationId: request.params.orgId,
        connectionExternalId: body.externalConnectionId,
        redirectUri,
        state,
      });
      return { data: result };
    },
  );

  // POST /:orgId/bank/connect/callback — exchange auth code and persist connection
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/bank/connect/callback",
    async (request, reply) => {
      const body = parseBody(bankConnectCallbackSchema, request.body);
      const redirectUri = normalizeRedirectUri(body.redirectUri);
      if (!allowedRedirectUris.has(redirectUri)) {
        return reply.status(400).send({
          error: "Redirect URI är inte tillåten",
          code: "BANK_OAUTH_INVALID_REDIRECT_URI",
        });
      }

      const statePayload = parseSignedOauthState(body.state, fastify.bankAuthStateSecret);
      if (
        !statePayload ||
        statePayload.exp < Date.now() ||
        statePayload.orgId !== request.params.orgId ||
        statePayload.externalConnectionId !== body.externalConnectionId ||
        statePayload.redirectUri !== redirectUri
      ) {
        return reply.status(400).send({
          error: "Ogiltig eller utgången OAuth-state",
          code: "BANK_OAUTH_INVALID_STATE",
        });
      }

      const tokenSet = await adapter.exchangeAuthorizationCode({
        code: body.code,
        redirectUri,
      });

      const result = await fastify.repos.bankConnections.create(request.params.orgId, {
        provider: adapter.provider,
        externalConnectionId: body.externalConnectionId,
        ...(body.displayName != null && { displayName: body.displayName }),
        currency: "SEK",
        status: "CONNECTED",
        authExpiresAt: tokenSet.expiresAt,
        metadata: {
          auth: {
            accessToken: tokenSet.accessToken,
            refreshToken: tokenSet.refreshToken,
            expiresAt: tokenSet.expiresAt.toISOString(),
            tokenType: tokenSet.tokenType,
            scope: tokenSet.scope,
          },
        },
      });

      if (!result.ok) {
        if (result.error.code === "DUPLICATE_CONNECTION") {
          throw AppError.conflict(result.error.message);
        }
        throw AppError.badRequest(result.error.message, result.error.code);
      }

      // Strip auth metadata before returning
      const { metadata: _metadata, ...safeConnection } = result.value;
      return reply.status(201).send({ data: safeConnection });
    },
  );

  // POST /:orgId/bank/:connectionId/sync — trigger a manual sync
  fastify.post<{ Params: { orgId: string; connectionId: string } }>(
    "/:orgId/bank/:connectionId/sync",
    async (request) => {
      const body = parseBody(bankSyncBodySchema, request.body ?? {});
      const { orgId, connectionId } = request.params;

      const syncResult = await bankSync.syncConnection({
        organizationId: orgId,
        connectionId,
        trigger: "MANUAL",
        ...(body.fromDate != null && { fromDate: new Date(body.fromDate) }),
        ...(body.toDate != null && { toDate: new Date(body.toDate) }),
        ...(body.pageSize != null && { pageSize: body.pageSize }),
      });

      return { data: syncResult };
    },
  );

  // GET /:orgId/bank/connections — list all connections (auth metadata stripped)
  fastify.get<{ Params: { orgId: string } }>("/:orgId/bank/connections", async (request) => {
    const connections = await fastify.repos.bankConnections.findByOrganization(
      request.params.orgId,
    );
    const safe = connections.map((connection: (typeof connections)[number]) => {
      const { metadata: _metadata, ...rest } = connection;
      return rest;
    });
    return { data: safe };
  });

  // GET /:orgId/bank/:connectionId/transactions — paginated transaction list
  fastify.get<{
    Params: { orgId: string; connectionId: string };
    Querystring: {
      page?: string;
      limit?: string;
      fromDate?: string;
      toDate?: string;
      matchStatus?: string;
    };
  }>("/:orgId/bank/:connectionId/transactions", async (request, reply) => {
    const { orgId, connectionId } = request.params;
    const q = request.query;

    const connection = await fastify.repos.bankConnections.findById(connectionId, orgId);
    if (!connection) {
      return reply.status(404).send({ error: "Bankkopplingen hittades inte" });
    }

    return fastify.repos.bankTransactions.findByConnectionPaginated(connectionId, orgId, {
      page: q.page != null ? parseInt(q.page, 10) : 1,
      limit: q.limit != null ? parseInt(q.limit, 10) : 20,
      ...(q.fromDate != null && { fromDate: new Date(q.fromDate) }),
      ...(q.toDate != null && { toDate: new Date(q.toDate) }),
      ...(q.matchStatus != null && {
        matchStatus: q.matchStatus as BankTransactionMatchStatus,
      }),
    });
  });

  // GET /:orgId/bank/transactions/:transactionId/match-candidates — suggest vouchers to match
  fastify.get<{
    Params: { orgId: string; transactionId: string };
    Querystring: { limit?: string | number };
  }>("/:orgId/bank/transactions/:transactionId/match-candidates", async (request) => {
    const query = parseBody(bankMatchCandidatesQuerySchema, request.query ?? {});
    const data = await bankMatching.getMatchCandidates(
      request.params.orgId,
      request.params.transactionId,
      query.limit ?? 10,
    );

    return { data };
  });

  // POST /:orgId/bank/transactions/:transactionId/match — match transaction to voucher
  fastify.post<{
    Params: { orgId: string; transactionId: string };
  }>("/:orgId/bank/transactions/:transactionId/match", async (request, reply) => {
    const body = parseBody(bankTransactionMatchSchema, request.body ?? {});
    const data = await bankMatching.matchTransaction({
      organizationId: request.params.orgId,
      transactionId: request.params.transactionId,
      voucherId: body.voucherId,
      ...(body.matchConfidence != null && { matchConfidence: body.matchConfidence }),
      ...(body.matchNote != null && { matchNote: body.matchNote }),
    });

    return reply.status(200).send({ data });
  });

  // POST /:orgId/bank/transactions/:transactionId/unmatch — clear voucher match
  fastify.post<{
    Params: { orgId: string; transactionId: string };
  }>("/:orgId/bank/transactions/:transactionId/unmatch", async (request, reply) => {
    const data = await bankMatching.unmatchTransaction(
      request.params.orgId,
      request.params.transactionId,
    );

    return reply.status(200).send({ data });
  });

  // POST /:orgId/bank/transactions/:transactionId/confirm — confirm matched transaction
  fastify.post<{
    Params: { orgId: string; transactionId: string };
  }>("/:orgId/bank/transactions/:transactionId/confirm", async (request, reply) => {
    const body = parseBody(bankTransactionConfirmSchema, request.body ?? {});
    const data = await bankMatching.confirmTransaction(
      request.params.orgId,
      request.params.transactionId,
      body.matchNote,
    );

    return reply.status(200).send({ data });
  });

  // POST /:orgId/bank/transactions/:transactionId/create-voucher — create and match voucher
  fastify.post<{
    Params: { orgId: string; transactionId: string };
  }>("/:orgId/bank/transactions/:transactionId/create-voucher", async (request, reply) => {
    const body = parseBody(bankTransactionCreateVoucherSchema, request.body ?? {});
    const data = await bankMatching.createVoucherFromTransaction({
      organizationId: request.params.orgId,
      transactionId: request.params.transactionId,
      ...(body.fiscalYearId != null && { fiscalYearId: body.fiscalYearId }),
      bankAccountNumber: body.bankAccountNumber,
      counterAccountNumber: body.counterAccountNumber,
      ...(body.description != null && { description: body.description }),
      ...(body.matchNote != null && { matchNote: body.matchNote }),
      ...(body.createdBy != null && { createdBy: body.createdBy }),
    });

    return reply.status(201).send({ data });
  });

  // POST /:orgId/bank/transactions/bulk/confirm — confirm multiple matched transactions
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/bank/transactions/bulk/confirm",
    async (request, reply) => {
      const body = parseBody(bankBulkConfirmSchema, request.body ?? {});
      const count = await bankMatching.bulkConfirmTransactions(
        request.params.orgId,
        body.transactionIds,
      );

      return reply.status(200).send({ data: { updated: count } });
    },
  );

  // POST /:orgId/bank/transactions/bulk/unmatch — unmatch multiple transactions
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/bank/transactions/bulk/unmatch",
    async (request, reply) => {
      const body = parseBody(bankBulkUnmatchSchema, request.body ?? {});
      const count = await bankMatching.bulkUnmatchTransactions(
        request.params.orgId,
        body.transactionIds,
      );

      return reply.status(200).send({ data: { updated: count } });
    },
  );

  // POST /:orgId/bank/webhooks — ingest provider webhook event
  fastify.post<{ Params: { orgId: string } }>("/:orgId/bank/webhooks", async (request) => {
    const body = parseBody(bankWebhookCreateSchema, request.body);
    const orgId = request.params.orgId;
    const webhookSecret = resolveWebhookSecret(body.provider);

    let signatureValidated = body.signatureValidated;
    if (webhookSecret != null) {
      const headerValue = request.headers["x-webhook-signature"];
      const signatureHeader =
        typeof headerValue === "string"
          ? headerValue
          : Array.isArray(headerValue)
            ? headerValue[0]
            : undefined;

      if (!signatureHeader) {
        throw AppError.badRequest("Webhook-signatur saknas", "BANK_WEBHOOK_SIGNATURE_MISSING");
      }

      const providedSignature = normalizeSignature(signatureHeader);
      const expectedSignature = hmacSha256Hex(body.payload, webhookSecret);

      if (!signaturesMatch(providedSignature, expectedSignature)) {
        throw AppError.badRequest("Ogiltig webhook-signatur", "BANK_WEBHOOK_SIGNATURE_INVALID");
      }

      signatureValidated = true;
    }

    const created = await fastify.repos.bankWebhookEvents.create({
      organizationId: orgId,
      ...(body.connectionId != null && { connectionId: body.connectionId }),
      provider: body.provider,
      providerEventId: body.providerEventId,
      eventType: body.eventType,
      ...(signatureValidated != null && {
        signatureValidated,
      }),
      payload: body.payload,
      ...(body.receivedAt != null && { receivedAt: new Date(body.receivedAt) }),
    });

    if (!created.ok) {
      if (created.error.code === "DUPLICATE_PROVIDER_EVENT") {
        return {
          data: {
            duplicate: true,
            provider: body.provider,
            providerEventId: body.providerEventId,
          },
        };
      }
      throw AppError.badRequest(created.error.message, created.error.code);
    }

    const connectionId = body.connectionId;
    const shouldSync = connectionId != null && body.eventType.startsWith("transactions.");

    if (!shouldSync) {
      return { data: { eventId: created.value.id, processed: false } };
    }

    try {
      const syncResult = await bankSync.syncConnection({
        organizationId: orgId,
        connectionId,
        trigger: "WEBHOOK",
      });

      await fastify.repos.bankWebhookEvents.update(created.value.id, orgId, {
        status: "PROCESSED",
        processedAt: new Date(),
      });

      return {
        data: {
          eventId: created.value.id,
          processed: true,
          sync: syncResult,
        },
      };
    } catch (error) {
      await fastify.repos.bankWebhookEvents.update(created.value.id, orgId, {
        status: "FAILED",
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Okänt fel",
      });

      return {
        data: {
          eventId: created.value.id,
          processed: true,
          sync: {
            status: "FAILED",
          },
        },
      };
    }
  });

  // GET /:orgId/bank/webhooks — list recent webhook events
  fastify.get<{
    Params: { orgId: string };
    Querystring: { limit?: string | number };
  }>("/:orgId/bank/webhooks", async (request) => {
    const query = parseBody(bankWebhookListQuerySchema, request.query ?? {});
    const limit = query.limit ?? 20;
    const events = await fastify.repos.bankWebhookEvents.listRecentByOrganization(
      request.params.orgId,
      limit,
    );

    return { data: events };
  });

  // GET /:orgId/bank/:connectionId/sync-runs — list recent sync runs for a connection
  fastify.get<{
    Params: { orgId: string; connectionId: string };
    Querystring: { limit?: string | number };
  }>("/:orgId/bank/:connectionId/sync-runs", async (request, reply) => {
    const { orgId, connectionId } = request.params;
    const query = parseBody(bankSyncRunListQuerySchema, request.query ?? {});

    const connection = await fastify.repos.bankConnections.findById(connectionId, orgId);
    if (!connection) {
      return reply.status(404).send({ error: "Bankkopplingen hittades inte" });
    }

    const runs = await fastify.repos.bankSyncRuns.findLatestByConnection(
      connectionId,
      orgId,
      query.limit ?? 10,
    );

    return { data: runs };
  });

  // POST /:orgId/bank/:connectionId/auth/refresh — refresh expired bank auth token
  fastify.post<{ Params: { orgId: string; connectionId: string } }>(
    "/:orgId/bank/:connectionId/auth/refresh",
    async (request, reply) => {
      const { orgId, connectionId } = request.params;

      const connection = await fastify.repos.bankConnections.findById(connectionId, orgId);
      if (!connection) {
        return reply.status(404).send({ error: "Bankkopplingen hittades inte" });
      }

      const meta = connection.metadata as { auth?: { refreshToken?: string } } | null | undefined;
      const refreshToken = meta?.auth?.refreshToken;

      if (!refreshToken) {
        throw AppError.badRequest(
          "Bankanslutningen saknar refresh token. Återanslut banken.",
          "BANK_REFRESH_TOKEN_MISSING",
        );
      }

      let tokenSet;
      try {
        tokenSet = await adapter.refreshAccessToken(refreshToken);
      } catch (error) {
        const isUnauthorized =
          error instanceof BankAdapterError && error.code === "ADAPTER_UNAUTHORIZED";

        if (isUnauthorized) {
          await fastify.repos.bankConnections.updateStatus(connectionId, orgId, {
            status: "AUTH_REQUIRED",
            lastErrorCode: "ADAPTER_UNAUTHORIZED",
            lastErrorMessage: "Refresh token har gått ut",
          });
          throw new AppError(
            401,
            "BANK_AUTH_REQUIRED",
            "Bankautentisering har gått ut. Återanslut banken.",
          );
        }
        throw error;
      }

      const newMeta = {
        ...(typeof meta === "object" && meta !== null ? meta : {}),
        auth: {
          accessToken: tokenSet.accessToken,
          ...(tokenSet.refreshToken != null && { refreshToken: tokenSet.refreshToken }),
          expiresAt: tokenSet.expiresAt.toISOString(),
          tokenType: tokenSet.tokenType,
          ...(tokenSet.scope != null && { scope: tokenSet.scope }),
        },
      };

      const updateResult = await fastify.repos.bankConnections.update(connectionId, orgId, {
        status: "CONNECTED",
        authExpiresAt: tokenSet.expiresAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: newMeta,
      });

      if (!updateResult.ok) {
        throw AppError.internal("Kunde inte uppdatera bankanslutning efter token refresh");
      }

      return reply.status(200).send({
        data: {
          connectionId,
          status: "CONNECTED",
          authExpiresAt: tokenSet.expiresAt,
        },
      });
    },
  );
}
