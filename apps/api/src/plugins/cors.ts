/**
 * Minimal CORS plugin — replaces @fastify/cors for this API's needs:
 * a single configured origin, credentials, and preflight handling.
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export interface CorsOptions {
  /** The single allowed origin (exact match). */
  origin: string;
  /** Whether to allow credentials (cookies/authorization). */
  credentials?: boolean;
}

const corsPlugin: FastifyPluginAsync<CorsOptions> = async (fastify, options) => {
  const origin = options.origin;
  const credentials = options.credentials ?? false;

  fastify.addHook("onRequest", async (request, reply) => {
    // Respond to preflight requests directly.
    if (request.method === "OPTIONS" && request.headers["access-control-request-method"]) {
      reply
        .header("access-control-allow-origin", origin)
        .header("access-control-allow-methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
        .header(
          "access-control-allow-headers",
          request.headers["access-control-request-headers"] ?? "content-type, authorization",
        )
        .header("access-control-max-age", "600");
      if (credentials) {
        reply.header("access-control-allow-credentials", "true");
      }
      reply.header("vary", "Origin");
      return reply.code(204).send();
    }

    // Regular requests: advertise the configured origin (single-origin setup
    // means the header value is static, exactly like @fastify/cors with a
    // string origin). Vary: Origin keeps caches honest for cross-origin hits.
    reply.header("access-control-allow-origin", origin);
    if (credentials) {
      reply.header("access-control-allow-credentials", "true");
    }
    reply.header("vary", "Origin");
  });
};

export default fp(corsPlugin, { name: "cors" });
