import { z } from "zod";

export const bankConnectInitSchema = z.object({
  externalConnectionId: z.string().min(1),
  redirectUri: z.string().url(),
});

export const bankConnectCallbackSchema = z.object({
  code: z.string().min(1),
  externalConnectionId: z.string().min(1),
  redirectUri: z.string().url(),
  state: z.string().min(1),
  displayName: z.string().optional(),
});

export const bankSyncBodySchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

export const bankWebhookCreateSchema = z.object({
  provider: z.string().min(1),
  providerEventId: z.string().min(1),
  eventType: z.string().min(1),
  connectionId: z.string().min(1).optional(),
  signatureValidated: z.boolean().optional(),
  payload: z.unknown(),
  receivedAt: z.string().datetime().optional(),
});

export const bankWebhookListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const bankSyncRunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const bankMatchCandidatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const bankTransactionMatchSchema = z.object({
  voucherId: z.string().min(1),
  matchConfidence: z.number().int().min(0).max(100).optional(),
  matchNote: z.string().max(500).optional(),
});

export const bankTransactionConfirmSchema = z.object({
  matchNote: z.string().max(500).optional(),
});

export const bankBulkConfirmSchema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1).max(100),
});

export const bankBulkUnmatchSchema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1).max(100),
});

export const bankTransactionCreateVoucherSchema = z.object({
  fiscalYearId: z.string().min(1).optional(),
  bankAccountNumber: z.string().regex(/^\d{4}$/),
  counterAccountNumber: z.string().regex(/^\d{4}$/),
  description: z.string().min(1).max(255).optional(),
  matchNote: z.string().max(500).optional(),
  createdBy: z.string().min(1).optional(),
});
