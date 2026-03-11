/**
 * Prometheus metrics plugin.
 *
 * Collects default Node.js metrics (CPU, memory, event loop, GC)
 * and custom HTTP request metrics (counter + histogram).
 * The registry is decorated onto the Fastify instance so the
 * metrics route can expose it.
 */
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

/** Paths excluded from HTTP metrics to avoid self-referencing feedback loops. */
const EXCLUDED_PATHS = new Set(["/metrics", "/health"]);

async function metricsPlugin(fastify: FastifyInstance): Promise<void> {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const path = request.routeOptions?.url ?? request.url;
    if (EXCLUDED_PATHS.has(path)) return;

    const labels = {
      method: request.method,
      route: path,
      status_code: reply.statusCode,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
  });

  fastify.decorate("metricsRegistry", registry);
}

export default fp(metricsPlugin, { name: "metrics" });

declare module "fastify" {
  interface FastifyInstance {
    metricsRegistry: Registry;
  }
}
