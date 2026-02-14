/**
 * Build a Fastify app instance with all routes registered.
 * Separated from server startup for testability.
 */
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { organizationRoutes } from "./routes/organizations.js";
import { voucherRoutes } from "./routes/vouchers.js";
import { reportRoutes } from "./routes/reports.js";
import { sieRoutes } from "./routes/sie.js";
import { accountRoutes } from "./routes/accounts.js";
import { fiscalYearRoutes } from "./routes/fiscal-years.js";
import { documentRoutes } from "./routes/documents.js";
import type { Repositories } from "./repositories.js";

export interface BuildAppOptions {
  repos: Repositories;
  fastifyOptions?: FastifyServerOptions;
  corsOrigin?: string;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const fastify = Fastify(options.fastifyOptions ?? { logger: false });

  // Plugins
  await fastify.register(cors, {
    origin: options.corsOrigin ?? "http://localhost:5173",
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

  // Health check
  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  return fastify;
}

// Augment Fastify types so routes can access repos
declare module "fastify" {
  interface FastifyInstance {
    repos: Repositories;
  }
}
