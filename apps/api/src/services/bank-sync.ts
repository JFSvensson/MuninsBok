import type {
  BankConnection,
  BankSyncRun,
  BankSyncTrigger,
  UpsertBankTransactionInput,
} from "@muninsbok/core/types";
import { AppError } from "../utils/app-error.js";
import {
  type AdapterTokenSet,
  type IAggregatorBankAdapter,
  BankAdapterError,
  toBankAdapterAppError,
  toBankAdapterResultError,
} from "./bank-adapter.js";
import type { Repositories } from "../repositories.js";

interface BankAuthMetadata {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: "Bearer";
  scope?: string[];
}

interface BankSyncMetadata {
  cursor?: string;
}

interface BankConnectionMetadata {
  auth?: BankAuthMetadata;
  sync?: BankSyncMetadata;
}

export interface SyncBankConnectionInput {
  organizationId: string;
  connectionId: string;
  trigger?: BankSyncTrigger;
  fromDate?: Date;
  toDate?: Date;
  pageSize?: number;
  maxPages?: number;
}

export interface SyncBankConnectionResult {
  syncRunId: string;
  fetched: number;
  created: number;
  updated: number;
  nextCursor?: string;
}

export interface IBankSyncService {
  syncConnection(input: SyncBankConnectionInput): Promise<SyncBankConnectionResult>;
}

interface BankSyncServiceDeps {
  repos: Pick<
    Repositories,
    "bankConnections" | "bankTransactions" | "bankSyncRuns" | "bankWebhookEvents"
  >;
  adapter: IAggregatorBankAdapter;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  retryConfig?: Partial<BankSyncRetryConfig>;
}

interface BankSyncRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

const defaultRetryConfig: BankSyncRetryConfig = {
  maxRetries: 2,
  initialDelayMs: 250,
  maxDelayMs: 2_000,
  jitterFactor: 0.25,
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveRetryConfig(overrides?: Partial<BankSyncRetryConfig>): BankSyncRetryConfig {
  return {
    ...defaultRetryConfig,
    ...overrides,
    maxRetries: Math.max(0, overrides?.maxRetries ?? defaultRetryConfig.maxRetries),
    initialDelayMs: Math.max(0, overrides?.initialDelayMs ?? defaultRetryConfig.initialDelayMs),
    maxDelayMs: Math.max(0, overrides?.maxDelayMs ?? defaultRetryConfig.maxDelayMs),
    jitterFactor: Math.max(0, overrides?.jitterFactor ?? defaultRetryConfig.jitterFactor),
  };
}

function calculateRetryDelayMs(
  attempt: number,
  config: BankSyncRetryConfig,
  random: () => number,
): number {
  const baseDelay = Math.min(config.initialDelayMs * 2 ** attempt, config.maxDelayMs);
  const jitter = Math.round(baseDelay * config.jitterFactor * random());
  return baseDelay + jitter;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readMetadata(connection: BankConnection): BankConnectionMetadata {
  const metadata = asObject(connection.metadata);
  if (!metadata) return {};

  const authRaw = asObject(metadata["auth"]);
  const syncRaw = asObject(metadata["sync"]);

  const auth =
    authRaw != null &&
    typeof authRaw["accessToken"] === "string" &&
    typeof authRaw["expiresAt"] === "string" &&
    (authRaw["tokenType"] === "Bearer" || authRaw["tokenType"] == null)
      ? {
          accessToken: authRaw["accessToken"],
          ...(typeof authRaw["refreshToken"] === "string" && {
            refreshToken: authRaw["refreshToken"],
          }),
          expiresAt: authRaw["expiresAt"],
          tokenType: "Bearer" as const,
          ...(Array.isArray(authRaw["scope"]) && {
            scope: authRaw["scope"].filter((item): item is string => typeof item === "string"),
          }),
        }
      : undefined;

  const sync =
    syncRaw != null && typeof syncRaw["cursor"] === "string"
      ? { cursor: syncRaw["cursor"] }
      : undefined;

  return {
    ...(auth != null && { auth }),
    ...(sync != null && { sync }),
  };
}

function toAuthMetadata(tokenSet: AdapterTokenSet): BankAuthMetadata {
  return {
    accessToken: tokenSet.accessToken,
    ...(tokenSet.refreshToken != null && { refreshToken: tokenSet.refreshToken }),
    expiresAt: tokenSet.expiresAt.toISOString(),
    tokenType: tokenSet.tokenType,
    ...(tokenSet.scope != null && { scope: tokenSet.scope }),
  };
}

function toUpsertInput(tx: {
  externalTransactionId: string;
  bookedAt: Date;
  valueDate?: Date;
  description: string;
  amountOre: number;
  currency: string;
  reference?: string;
  counterpartyName?: string;
  rawData?: unknown;
}): UpsertBankTransactionInput {
  return {
    providerTransactionId: tx.externalTransactionId,
    bookedAt: tx.bookedAt,
    ...(tx.valueDate != null && { valueDate: tx.valueDate }),
    description: tx.description,
    amountOre: tx.amountOre,
    currency: tx.currency,
    ...(tx.reference != null && { reference: tx.reference }),
    ...(tx.counterpartyName != null && { counterpartyName: tx.counterpartyName }),
    ...(tx.rawData !== undefined && { rawData: tx.rawData }),
  };
}

async function ensureConnectionUpdate(
  deps: BankSyncServiceDeps,
  connection: BankConnection,
  data: {
    status?: "CONNECTED" | "AUTH_REQUIRED" | "SYNCING" | "FAILED";
    authExpiresAt?: Date | null;
    lastSyncedAt?: Date | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    metadata?: unknown;
  },
): Promise<BankConnection> {
  const updated = await deps.repos.bankConnections.update(
    connection.id,
    connection.organizationId,
    data,
  );

  if (!updated.ok) {
    throw AppError.internal("Kunde inte uppdatera bankanslutningens status");
  }

  return updated.value;
}

export class BankSyncService implements IBankSyncService {
  constructor(private readonly deps: BankSyncServiceDeps) {}

  private async runAdapterOperationWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    const config = resolveRetryConfig(this.deps.retryConfig);
    const random = this.deps.random ?? Math.random;
    const sleepFn = this.deps.sleep ?? sleep;

    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const mapped = toBankAdapterResultError(error);
        if (!mapped.retryable || attempt >= config.maxRetries) {
          throw error;
        }

        const delayMs = calculateRetryDelayMs(attempt, config, random);
        await sleepFn(delayMs);
      }
    }
  }

  async syncConnection(input: SyncBankConnectionInput): Promise<SyncBankConnectionResult> {
    const now = this.deps.now ?? (() => new Date());
    const connection = await this.deps.repos.bankConnections.findById(
      input.connectionId,
      input.organizationId,
    );

    if (!connection) {
      throw AppError.notFound("Bankanslutningen");
    }

    if (connection.provider !== this.deps.adapter.provider) {
      throw AppError.badRequest(
        `Fel adapter för anslutningen. Förväntad '${connection.provider}', fick '${this.deps.adapter.provider}'.`,
        "BANK_ADAPTER_PROVIDER_MISMATCH",
      );
    }

    const fromDate =
      input.fromDate ?? connection.lastSyncedAt ?? new Date(now().getTime() - 30 * 86400000);
    const toDate = input.toDate ?? now();
    const maxPages = Math.max(1, Math.min(input.maxPages ?? 10, 50));
    const pageSize = Math.max(1, Math.min(input.pageSize ?? 100, 200));

    let metadata = readMetadata(connection);
    let auth = metadata.auth;

    if (!auth || !auth.accessToken) {
      throw AppError.badRequest(
        "Bankanslutningen saknar giltig autentisering. Återanslut banken.",
        "BANK_AUTH_MISSING",
      );
    }

    const authExpiresAt = new Date(auth.expiresAt);
    if (Number.isNaN(authExpiresAt.getTime())) {
      throw AppError.badRequest(
        "Ogiltig token-expiration i anslutningsmetadata",
        "BANK_AUTH_INVALID",
      );
    }

    if (authExpiresAt.getTime() <= now().getTime() + 30_000) {
      if (!auth.refreshToken) {
        throw new AppError(
          401,
          "BANK_AUTH_REQUIRED",
          "Bankanslutningen kräver ny autentisering (refresh token saknas)",
        );
      }

      let refreshed: AdapterTokenSet;
      try {
        refreshed = await this.runAdapterOperationWithRetry(() =>
          this.deps.adapter.refreshAccessToken(auth?.refreshToken),
        );
      } catch (error) {
        throw toBankAdapterAppError(error);
      }

      metadata = {
        ...metadata,
        auth: toAuthMetadata(refreshed),
      };

      await ensureConnectionUpdate(this.deps, connection, {
        status: "CONNECTED",
        authExpiresAt: refreshed.expiresAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata,
      });

      auth = metadata.auth;
      if (!auth) {
        throw AppError.internal("Kunde inte läsa uppdaterad auth-token efter refresh");
      }
    }

    const run = await this.deps.repos.bankSyncRuns.create(input.organizationId, connection.id, {
      trigger: input.trigger ?? "MANUAL",
      status: "RUNNING",
      startedAt: now(),
    });

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let cursor = metadata.sync?.cursor;

    try {
      for (let page = 0; page < maxPages; page++) {
        const pageResult = await this.runAdapterOperationWithRetry(() =>
          this.deps.adapter.fetchTransactions({
            externalConnectionId: connection.externalConnectionId,
            accessToken: auth.accessToken,
            fromDate,
            toDate,
            ...(cursor != null && { cursor }),
            pageSize,
          }),
        );

        if (pageResult.transactions.length === 0) {
          cursor = pageResult.nextCursor;
          break;
        }

        const upsert = await this.deps.repos.bankTransactions.upsertMany(
          input.organizationId,
          connection.id,
          pageResult.transactions.map(toUpsertInput),
        );

        if (!upsert.ok) {
          throw new AppError(500, upsert.error.code, upsert.error.message);
        }

        fetched += pageResult.transactions.length;
        created += upsert.value.created;
        updated += upsert.value.updated;

        cursor = pageResult.nextCursor;
        if (!cursor) break;
      }

      const completedAt = now();
      await this.deps.repos.bankSyncRuns.complete(run.id, input.organizationId, {
        status: "SUCCEEDED",
        completedAt,
        importedCount: created,
        updatedCount: updated,
        failedCount: 0,
        errorCode: null,
        errorMessage: null,
      });

      const nextMetadata: BankConnectionMetadata = {
        ...metadata,
        sync: {
          ...(metadata.sync ?? {}),
          ...(cursor != null && { cursor }),
        },
      };

      await ensureConnectionUpdate(this.deps, connection, {
        status: "CONNECTED",
        lastSyncedAt: completedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: nextMetadata,
      });

      return {
        syncRunId: run.id,
        fetched,
        created,
        updated,
        ...(cursor != null && { nextCursor: cursor }),
      };
    } catch (error) {
      const mapped = toBankAdapterResultError(error);
      const completedAt = now();

      await this.deps.repos.bankSyncRuns.complete(run.id, input.organizationId, {
        status: "FAILED",
        completedAt,
        importedCount: created,
        updatedCount: updated,
        failedCount: Math.max(1, fetched - (created + updated)),
        errorCode: mapped.code,
        errorMessage: mapped.message,
      });

      await ensureConnectionUpdate(this.deps, connection, {
        status: mapped.code === "ADAPTER_UNAUTHORIZED" ? "AUTH_REQUIRED" : "FAILED",
        lastErrorCode: mapped.code,
        lastErrorMessage: mapped.message,
      });

      if (error instanceof AppError) throw error;
      if (error instanceof BankAdapterError) throw toBankAdapterAppError(error);
      throw AppError.internal("Banksynk misslyckades");
    }
  }
}

export function createBankSyncService(deps: BankSyncServiceDeps): IBankSyncService {
  return new BankSyncService(deps);
}
