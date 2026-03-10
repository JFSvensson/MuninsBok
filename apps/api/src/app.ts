/**
 * Build a Fastify app instance with all routes registered.
 * Separated from server startup for testability.
 */
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { IDocumentStorage } from "@muninsbok/core/types";
import { AppError } from "./utils/app-error.js";
import requestLogging from "./plugins/request-logging.js";
import auditLogging from "./plugins/audit-logging.js";
import jwtAuth from "./plugins/jwt-auth.js";
import rbac from "./plugins/rbac.js";
import { organizationRoutes } from "./routes/organizations.js";
import { voucherRoutes } from "./routes/vouchers.js";
import { voucherTemplateRoutes } from "./routes/voucher-templates.js";
import { budgetRoutes } from "./routes/budgets.js";
import { reportRoutes } from "./routes/reports.js";
import { sieRoutes } from "./routes/sie.js";
import { accountRoutes } from "./routes/accounts.js";
import { fiscalYearRoutes } from "./routes/fiscal-years.js";
import { documentRoutes } from "./routes/documents.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { authRoutes } from "./routes/auth.js";
import { memberRoutes } from "./routes/members.js";
import type { Repositories } from "./repositories.js";
// Side-effect import: augments FastifyRequest with `org` property
import "./plugins/org-scope.js";

export interface BuildAppOptions {
  repos: Repositories;
  documentStorage: IDocumentStorage;
  fastifyOptions?: FastifyServerOptions;
  corsOrigin?: string;
  apiKey?: string;
  /** JWT secret. When set, enables JWT authentication. */
  jwtSecret?: string;
  /** Access token TTL (default: "15m") */
  accessTokenTtl?: string;
  /** Refresh token TTL (default: "7d") */
  refreshTokenTtl?: string;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const fastify = Fastify({
    ...(options.fastifyOptions ?? { logger: false }),
    bodyLimit: 1_048_576, // 1 MB — keep tight; file uploads use multipart streaming
    connectionTimeout: 10_000, // 10 s — reject slow connections early
    requestTimeout: 30_000, // 30 s — prevent hung requests in production
  });

  // Plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // CSP handled by frontend / nginx
  });

  await fastify.register(cookie);

  await fastify.register(cors, {
    origin: options.corsOrigin ?? "http://localhost:5173",
    credentials: true,
  });

  // OpenAPI / Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Munins bok API",
        description: "REST API för svensk bokföring",
        version: process.env["npm_package_version"] ?? "0.1.0",
      },
      tags: [
        { name: "auth", description: "Autentisering" },
        { name: "organizations", description: "Organisationer (tenants)" },
        { name: "accounts", description: "Kontoplan" },
        { name: "fiscal-years", description: "Räkenskapsår" },
        { name: "vouchers", description: "Verifikat" },
        { name: "reports", description: "Rapporter" },
        { name: "sie", description: "SIE-import / export" },
        { name: "documents", description: "Dokument / bilagor" },
        { name: "dashboard", description: "Översikt" },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await fastify.register(rateLimit, {
    max: (request) => {
      // Stricter limit for write operations (create, update, delete)
      const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
      return writeMethods.has(request.method) ? 30 : 100;
    },
    timeWindow: "1 minute",
  });

  // Structured request logging with trace IDs
  await fastify.register(requestLogging);

  // Audit trail for write operations
  await fastify.register(auditLogging);

  // JWT authentication (when secret is provided)
  if (options.jwtSecret) {
    await fastify.register(jwtAuth, {
      secret: options.jwtSecret,
      ...(options.accessTokenTtl != null && { accessTokenTtl: options.accessTokenTtl }),
      ...(options.refreshTokenTtl != null && { refreshTokenTtl: options.refreshTokenTtl }),
    });

    // RBAC — requires jwt-auth to be registered first
    await fastify.register(rbac);
  }

  // Optional API key authentication (legacy / simple setups without JWT)
  // When JWT is enabled, API key auth is skipped to avoid conflicts.
  if (options.apiKey && !options.jwtSecret) {
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

  // Global error handler — structured JSON for all errors
  fastify.setErrorHandler(
    (error: Error & { statusCode?: number; code?: string }, request, reply) => {
      // AppError carries its own status code and error code
      if (error instanceof AppError) {
        if (error.statusCode >= 500) {
          request.log.error(error, "unhandled error");
        }
        return reply.status(error.statusCode).send({
          error: error.message,
          code: error.code,
          statusCode: error.statusCode,
          requestId: request.id,
        });
      }

      // Fastify / plugin errors (validation, rate-limit, etc.)
      const statusCode = error.statusCode ?? 500;

      if (statusCode >= 500) {
        request.log.error(error, "unhandled error");
      }

      return reply.status(statusCode).send({
        error: statusCode >= 500 ? "Internt serverfel" : error.message,
        code: error.code ?? "INTERNAL_ERROR",
        statusCode,
        requestId: request.id,
      });
    },
  );

  // Decorate with repositories so routes can access them
  fastify.decorate("repos", options.repos);
  fastify.decorate("documentStorage", options.documentStorage);

  // Auth routes (register, login, refresh, me)
  if (options.jwtSecret) {
    await fastify.register(authRoutes, { prefix: "/api/auth" });
  }

  // Routes — all org-scoped routes share the org-scope preHandler
  await fastify.register(
    async function orgScoped(instance) {
      // Require JWT authentication on all org-scoped routes (when enabled)
      if (options.jwtSecret) {
        instance.addHook("onRequest", instance.authenticate);
      }

      // Validate `:orgId` exists before any route handler in this scope
      instance.addHook("preHandler", async (request, reply) => {
        const orgId = (request.params as Record<string, string | undefined>)["orgId"];
        if (!orgId) return; // List / create routes — no orgId to validate

        const org = await instance.repos.organizations.findById(orgId);
        if (!org) {
          return reply.status(404).send({ error: "Organisationen hittades inte" });
        }

        request.org = org;
      });

      // Verify org membership for routes with :orgId (when JWT is enabled)
      if (options.jwtSecret) {
        instance.addHook("preHandler", instance.requireMembership);
      }

      await instance.register(organizationRoutes);
      // Member management requires RBAC (only available with JWT)
      if (options.jwtSecret) {
        await instance.register(memberRoutes);
      }
      await instance.register(voucherRoutes);
      await instance.register(voucherTemplateRoutes);
      await instance.register(budgetRoutes);
      await instance.register(reportRoutes);
      await instance.register(sieRoutes);
      await instance.register(accountRoutes);
      await instance.register(fiscalYearRoutes);
      await instance.register(documentRoutes);
      await instance.register(dashboardRoutes);
    },
    { prefix: "/api/organizations" },
  );

  // Health check with database connectivity test
  fastify.get("/health", async () => {
    let dbStatus: "ok" | "error" = "error";
    try {
      await options.repos.prisma.$queryRaw`SELECT 1`;
      dbStatus = "ok";
    } catch {
      // dbStatus remains "error"
    }

    const mem = process.memoryUsage();
    const status = dbStatus === "ok" ? "ok" : "degraded";

    return {
      status,
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env["npm_package_version"] ?? "0.1.0",
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
    };
  });

  return fastify;
}

// Augment Fastify types so routes can access repos
declare module "fastify" {
  interface FastifyInstance {
    repos: Repositories;
    documentStorage: IDocumentStorage;
  }
}
