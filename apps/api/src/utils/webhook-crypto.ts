/**
 * Shared HMAC helpers for bank webhook signature handling.
 *
 * Used by both the org-scoped bank routes and the public webhook
 * ingestion route, so the crypto lives in exactly one place.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(payload: unknown, secret: string): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

/** HMAC over a raw string (used for OAuth state signing). */
export function hmacSha256HexRaw(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Strip an optional "sha256=" algorithm prefix from a signature header. */
export function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  return trimmed.startsWith("sha256=") ? trimmed.slice(7) : trimmed;
}

/** Constant-time comparison of two hex-encoded HMAC signatures. */
export function signaturesMatch(provided: string, expected: string): boolean {
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

/** Resolve the HMAC secret for a provider, falling back to the shared secret. */
export function resolveWebhookSecret(provider: string): string | undefined {
  const normalizedProvider = provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return (
    process.env[`BANK_WEBHOOK_${normalizedProvider}_HMAC_SECRET`] ??
    process.env["BANK_WEBHOOK_HMAC_SECRET"]
  );
}
