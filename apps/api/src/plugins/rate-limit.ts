/**
 * Minimal rate limiting plugin — replaces @fastify/rate-limit.
 *
 * Fixed-window counter per (IP, route). Supports the same global `max`
 * (number or function) + `timeWindow` options and per-route overrides via
 * `config.rateLimit: { max, timeWindow }` as @fastify/rate-limit, which is
 * all this API uses.
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Per-route rate limit override, e.g. { max: 5, timeWindow: "1 minute" }. */
    rateLimit?: { max?: number; timeWindow?: string | number };
  }
}

export interface RateLimitOptions {
  /** Max requests per window: a number or a function of the request. */
  max: number | ((request: FastifyRequest) => number);
  /** Window size, e.g. "1 minute" or milliseconds. */
  timeWindow: string | number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const TIME_UNITS: Record<string, number> = {
  millisecond: 1,
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

function parseTimeWindow(value: string | number): number {
  if (typeof value === "number") return value;
  const match = /^(\d+)\s*(millisecond|second|minute|hour|day)s?$/i.exec(value.trim());
  const amount = match?.[1];
  const unit = match?.[2]?.toLowerCase();
  if (!amount || !unit) {
    throw new Error(`Unsupported timeWindow: "${value}"`);
  }
  return Number(amount) * (TIME_UNITS[unit] ?? 1);
}

const rateLimitPlugin: FastifyPluginAsync<RateLimitOptions> = async (fastify, options) => {
  const globalWindowMs = parseTimeWindow(options.timeWindow);
  const buckets = new Map<string, WindowEntry>();

  // Periodically drop expired entries so the map does not grow unboundedly.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }, globalWindowMs);
  sweeper.unref();
  fastify.addHook("onClose", async () => clearInterval(sweeper));

  fastify.addHook("onRequest", async (request, reply) => {
    const routeConfig = request.routeOptions.config.rateLimit;

    const max =
      routeConfig?.max ?? (typeof options.max === "function" ? options.max(request) : options.max);
    const windowMs = routeConfig?.timeWindow
      ? parseTimeWindow(routeConfig.timeWindow)
      : globalWindowMs;

    const key = `${request.ip}:${request.routeOptions.url ?? request.url}`;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    reply.header("x-ratelimit-limit", String(max));
    reply.header("x-ratelimit-remaining", String(remaining));
    reply.header("x-ratelimit-reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      reply.header("retry-after", String(retryAfter));
      return reply.code(429).send({ error: "För många anrop — försök igen senare." });
    }
  });
};

export default fp(rateLimitPlugin, { name: "rate-limit" });
