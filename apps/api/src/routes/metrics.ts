/**
 * Prometheus metrics route.
 *
 * Exposes `GET /metrics` returning all registered metrics in
 * Prometheus text exposition format.
 */
import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";

interface MetricsRouteOptions {
  token?: string;
}

export async function metricsRoute(
  fastify: FastifyInstance,
  options: MetricsRouteOptions,
): Promise<void> {
  fastify.get("/metrics", async (request, reply) => {
    if (options.token) {
      const expected = `Bearer ${options.token}`;
      const authHeader = request.headers.authorization;
      const providedBuffer = Buffer.from(authHeader ?? "", "utf8");
      const expectedBuffer = Buffer.from(expected, "utf8");
      const matches =
        providedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(providedBuffer, expectedBuffer);

      if (!matches) {
        return reply.status(401).send({
          error: "Ogiltig eller saknad metrics-token",
          code: "UNAUTHORIZED",
        });
      }
    }

    const metrics = await fastify.metricsRegistry.metrics();
    return reply.type(fastify.metricsRegistry.contentType).send(metrics);
  });
}
