/**
 * Audit logging plugin.
 *
 * Logs every mutating request (POST / PUT / PATCH / DELETE) with structured
 * data for traceability and compliance. The audit record includes:
 *
 * - userId (authenticated user, if available)
 * - requestId (from the request-logging plugin)
 * - method & url
 * - status code
 * - duration
 * - timestamp
 *
 * The logging goes through Pino (same as request-logging) so it ends up in
 * the structured log stream and can be shipped to any SIEM.
 */
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

interface JwtUser {
  sub: string;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function auditLogging(fastify: FastifyInstance): Promise<void> {
  function sanitizeUrl(url: string): string {
    return url.split("?")[0] ?? url;
  }

  fastify.addHook("onResponse", async (request, reply) => {
    if (!WRITE_METHODS.has(request.method)) return;

    const user = request.user as JwtUser | undefined;

    request.log.info(
      {
        audit: true,
        userId: user?.sub ?? null,
        requestId: request.id,
        method: request.method,
        url: sanitizeUrl(request.url),
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        timestamp: new Date().toISOString(),
      },
      "audit: write operation",
    );
  });
}

export default fp(auditLogging, { name: "audit-logging" });
