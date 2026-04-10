/**
 * Bank webhook ingestion endpoint.
 *
 * Registered **outside** the JWT-protected org-scoped routes so that
 * external bank providers can reach it with HMAC-signed payloads only.
 *
 * Route: POST /api/webhooks/bank/:orgId
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "../utils/app-error.js";
import { parseBody } from "../utils/parse-body.js";
import { bankWebhookCreateSchema } from "../schemas/index.js";

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

export async function bankWebhookRoutes(fastify: FastifyInstance) {
  const bankSync = fastify.bankSync;

  // POST /:orgId — ingest provider webhook event (HMAC-authenticated, no JWT)
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const body = parseBody(bankWebhookCreateSchema, request.body);
      const orgId = request.params.orgId;

      // Verify the organization exists
      const org = await fastify.repos.organizations.findById(orgId);
      if (!org) {
        throw AppError.notFound("Organisationen");
      }

      // HMAC signature is required on this public endpoint
      const webhookSecret = resolveWebhookSecret(body.provider);
      if (!webhookSecret) {
        throw AppError.badRequest(
          "Webhook-hemlighet ej konfigurerad för leverantören",
          "BANK_WEBHOOK_SECRET_MISSING",
        );
      }

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

      const created = await fastify.repos.bankWebhookEvents.create({
        organizationId: orgId,
        ...(body.connectionId != null && { connectionId: body.connectionId }),
        provider: body.provider,
        providerEventId: body.providerEventId,
        eventType: body.eventType,
        signatureValidated: true,
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
    },
  );
}
