/**
 * Build a Fastify app instance with all routes registered.
 * Separated from server startup for testability.
 */
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { organizationRoutes } from "./routes/organizations.js";
import { voucherRoutes } from "./routes/vouchers.js";
import { reportRoutes } from "./routes/reports.js";
import { sieRoutes } from "./routes/sie.js";
import { accountRoutes } from "./routes/accounts.js";
import { fiscalYearRoutes } from "./routes/fiscal-years.js";
import { documentRoutes } from "./routes/documents.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import type { Repositories } from "./repositories.js";

export interface BuildAppOptions {
  repos: Repositories;
  fastifyOptions?: FastifyServerOptions;
  corsOrigin?: string;
  apiKey?: string;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const fastify = Fastify(options.fastifyOptions ?? { logger: false });

  // Plugins
  await fastify.register(cors, {
    origin: options.corsOrigin ?? "http://localhost:5173",
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Optional API key authentication
  if (options.apiKey) {
    fastify.addHook("onRequest", async (request, reply) => {
      // Skip auth for health check
      if (request.url === "/health") return;

      const authHeader = request.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${options.apiKey}`) {
        return reply
          .status(401)
          .send({ error: "Ogiltig eller saknad API-nyckel", code: "UNAUTHORIZED" });
      }
    });
  }

  // Global error handler — structured JSON for unexpected errors
  fastify.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      fastify.log.error(error);
    }

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internt serverfel" : error.message,
      code: error.code ?? "INTERNAL_ERROR",
      statusCode,
    });
  });

  // Decorate with repositories so routes can access them
  fastify.decorate("repos", options.repos);

  // Routes
  await fastify.register(organizationRoutes, { prefix: "/api/organizations" });
  await fastify.register(voucherRoutes, { prefix: "/api/organizations" });
  await fastify.register(reportRoutes, { prefix: "/api/organizations" });
  await fastify.register(sieRoutes, { prefix: "/api/organizations" });
  await fastify.register(accountRoutes, { prefix: "/api/organizations" });
  await fastify.register(fiscalYearRoutes, { prefix: "/api/organizations" });
  await fastify.register(documentRoutes, { prefix: "/api/organizations" });
  await fastify.register(dashboardRoutes, { prefix: "/api/organizations" });

  // Health check with database connectivity test
  fastify.get("/health", async () => {
    let dbStatus: "ok" | "error" = "error";
    try {
      await options.repos.prisma.$queryRaw`SELECT 1`;
      dbStatus = "ok";
    } catch {
      // dbStatus remains "error"
    }

    const status = dbStatus === "ok" ? "ok" : "degraded";
    return { status, database: dbStatus, timestamp: new Date().toISOString() };
  });

  return fastify;
}

// Augment Fastify types so routes can access repos
declare module "fastify" {
  interface FastifyInstance {
    repos: Repositories;
  }
}
