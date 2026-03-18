export type BankConnectionStatus = "CONNECTED" | "AUTH_REQUIRED" | "SYNCING" | "FAILED";

export type BankTransactionMatchStatus = "PENDING_MATCH" | "MATCHED" | "CONFIRMED" | "ERROR";

export type BankSyncRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type BankSyncTrigger = "MANUAL" | "SCHEDULED" | "WEBHOOK";

export type BankWebhookEventStatus = "RECEIVED" | "PROCESSED" | "IGNORED" | "FAILED";

export interface BankConnection {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: string;
  readonly externalConnectionId: string;
  readonly displayName?: string | undefined;
  readonly accountName?: string | undefined;
  readonly accountIban?: string | undefined;
  readonly accountLast4?: string | undefined;
  readonly currency: string;
  readonly status: BankConnectionStatus;
  readonly authExpiresAt?: Date | undefined;
  readonly lastSyncedAt?: Date | undefined;
  readonly lastErrorCode?: string | undefined;
  readonly lastErrorMessage?: string | undefined;
  readonly metadata?: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateBankConnectionInput {
  readonly provider: string;
  readonly externalConnectionId: string;
  readonly displayName?: string | undefined;
  readonly accountName?: string | undefined;
  readonly accountIban?: string | undefined;
  readonly accountLast4?: string | undefined;
  readonly currency?: string | undefined;
  readonly status?: BankConnectionStatus | undefined;
  readonly authExpiresAt?: Date | undefined;
  readonly metadata?: unknown;
}

export interface UpdateBankConnectionInput {
  readonly displayName?: string | undefined;
  readonly accountName?: string | undefined;
  readonly accountIban?: string | undefined;
  readonly accountLast4?: string | undefined;
  readonly currency?: string | undefined;
  readonly status?: BankConnectionStatus | undefined;
  readonly authExpiresAt?: Date | null | undefined;
  readonly lastSyncedAt?: Date | null | undefined;
  readonly lastErrorCode?: string | null | undefined;
  readonly lastErrorMessage?: string | null | undefined;
  readonly metadata?: unknown;
}

export interface UpdateBankConnectionStatusInput {
  readonly status: BankConnectionStatus;
  readonly authExpiresAt?: Date | null | undefined;
  readonly lastSyncedAt?: Date | null | undefined;
  readonly lastErrorCode?: string | null | undefined;
  readonly lastErrorMessage?: string | null | undefined;
}

export type BankConnectionErrorCode = "NOT_FOUND" | "DUPLICATE_CONNECTION" | "INVALID_INPUT";

export interface BankConnectionError {
  readonly code: BankConnectionErrorCode;
  readonly message: string;
}

export interface BankTransaction {
  readonly id: string;
  readonly organizationId: string;
  readonly connectionId: string;
  readonly providerTransactionId: string;
  readonly bookedAt: Date;
  readonly valueDate?: Date | undefined;
  readonly description: string;
  readonly amountOre: number;
  readonly currency: string;
  readonly reference?: string | undefined;
  readonly counterpartyName?: string | undefined;
  readonly matchStatus: BankTransactionMatchStatus;
  readonly matchedVoucherId?: string | undefined;
  readonly matchConfidence?: number | undefined;
  readonly matchNote?: string | undefined;
  readonly rawData?: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertBankTransactionInput {
  readonly providerTransactionId: string;
  readonly bookedAt: Date;
  readonly valueDate?: Date | undefined;
  readonly description: string;
  readonly amountOre: number;
  readonly currency?: string | undefined;
  readonly reference?: string | undefined;
  readonly counterpartyName?: string | undefined;
  readonly rawData?: unknown;
}

export interface BankTransactionMatchUpdateInput {
  readonly status: BankTransactionMatchStatus;
  readonly matchedVoucherId?: string | null | undefined;
  readonly matchConfidence?: number | null | undefined;
  readonly matchNote?: string | null | undefined;
}

export type BankTransactionErrorCode = "NOT_FOUND" | "DUPLICATE_TRANSACTION" | "INVALID_INPUT";

export interface BankTransactionError {
  readonly code: BankTransactionErrorCode;
  readonly message: string;
}

export interface BankSyncRun {
  readonly id: string;
  readonly organizationId: string;
  readonly connectionId: string;
  readonly trigger: BankSyncTrigger;
  readonly status: BankSyncRunStatus;
  readonly externalRunId?: string | undefined;
  readonly startedAt: Date;
  readonly completedAt?: Date | undefined;
  readonly importedCount: number;
  readonly updatedCount: number;
  readonly failedCount: number;
  readonly errorCode?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateBankSyncRunInput {
  readonly trigger: BankSyncTrigger;
  readonly status?: BankSyncRunStatus | undefined;
  readonly externalRunId?: string | undefined;
  readonly startedAt?: Date | undefined;
}

export interface CompleteBankSyncRunInput {
  readonly status: BankSyncRunStatus;
  readonly completedAt?: Date | undefined;
  readonly importedCount?: number | undefined;
  readonly updatedCount?: number | undefined;
  readonly failedCount?: number | undefined;
  readonly errorCode?: string | null | undefined;
  readonly errorMessage?: string | null | undefined;
}

export type BankSyncRunErrorCode = "NOT_FOUND" | "INVALID_INPUT";

export interface BankSyncRunError {
  readonly code: BankSyncRunErrorCode;
  readonly message: string;
}

export interface BankWebhookEvent {
  readonly id: string;
  readonly organizationId: string;
  readonly connectionId?: string | undefined;
  readonly provider: string;
  readonly providerEventId: string;
  readonly eventType: string;
  readonly status: BankWebhookEventStatus;
  readonly signatureValidated: boolean;
  readonly payload: unknown;
  readonly receivedAt: Date;
  readonly processedAt?: Date | undefined;
  readonly errorMessage?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateBankWebhookEventInput {
  readonly organizationId: string;
  readonly connectionId?: string | undefined;
  readonly provider: string;
  readonly providerEventId: string;
  readonly eventType: string;
  readonly status?: BankWebhookEventStatus | undefined;
  readonly signatureValidated?: boolean | undefined;
  readonly payload: unknown;
  readonly receivedAt?: Date | undefined;
}

export interface UpdateBankWebhookEventInput {
  readonly status: BankWebhookEventStatus;
  readonly processedAt?: Date | null | undefined;
  readonly errorMessage?: string | null | undefined;
}

export type BankWebhookEventErrorCode = "NOT_FOUND" | "DUPLICATE_PROVIDER_EVENT" | "INVALID_INPUT";

export interface BankWebhookEventError {
  readonly code: BankWebhookEventErrorCode;
  readonly message: string;
}
