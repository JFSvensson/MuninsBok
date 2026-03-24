import { z } from "zod";

export const bankConnectInitSchema = z.object({
  externalConnectionId: z.string().min(1),
  redirectUri: z.string().url(),
});

export const bankConnectCallbackSchema = z.object({
  code: z.string().min(1),
  externalConnectionId: z.string().min(1),
  redirectUri: z.string().url(),
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
