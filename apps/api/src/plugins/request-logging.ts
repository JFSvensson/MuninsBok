/**
 * Request logging plugin.
 *
 * Adds a unique `requestId` (UUID) to every request and logs
 * request/response pairs with duration for observability.
 * The requestId is also returned in the `X-Request-Id` response header
 * so clients can reference it in bug reports.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

async function requestLogging(fastify: FastifyInstance): Promise<void> {
  function sanitizeUrl(url: string): string {
    return url.split("?")[0] ?? url;
  }

  fastify.addHook("onRequest", async (request, reply) => {
    // Prefer a client-supplied trace id (e.g. from a gateway), fall back to UUID
    const incomingId = request.headers["x-request-id"];
    const requestId =
      typeof incomingId === "string" && incomingId.length > 0 ? incomingId : randomUUID();

    // Fastify stores .id for built-in Pino child logger
    request.id = requestId;

    // Echo the id back so clients can correlate
    void reply.header("X-Request-Id", requestId);
  });

  fastify.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: sanitizeUrl(request.url),
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });
}

export default fp(requestLogging, { name: "request-logging" });
