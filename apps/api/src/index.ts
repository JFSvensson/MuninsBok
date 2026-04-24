import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from monorepo root (3 levels up from apps/api/src/)
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { prisma } from "@muninsbok/db";
import { buildApp } from "./app.js";
import { createRepositories } from "./repositories.js";
import { DocumentStorage } from "./services/document-storage.js";
import { TesseractReceiptOcrService } from "./services/receipt-ocr.js";
import { createBankAdapterFromEnv } from "./services/bank-adapter.sandbox.js";

// ------ Environment validation ------
const requiredEnv = ["DATABASE_URL"] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Saknade miljövariabler: ${missing.join(", ")}`);
  console.error("Kopiera .env.example → .env och fyll i värdena.");
  process.exit(1);
}

const nodeEnv = process.env["NODE_ENV"] ?? "development";
const isProd = nodeEnv === "production";
const enableDocs = process.env["ENABLE_DOCS"] === "true";
const metricsToken = process.env["METRICS_TOKEN"];

if (isProd && !process.env["JWT_SECRET"]) {
  console.error("JWT_SECRET måste sättas i produktion. Generera en hemlighet:");
  console.error("  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
  process.exit(1);
}

if (isProd && !process.env["CORS_ORIGIN"]) {
  console.error("CORS_ORIGIN måste sättas i produktion.");
  process.exit(1);
}

// ------ Build app ------
const repos = createRepositories(prisma);
const documentStorage = new DocumentStorage();
const receiptOcr = new TesseractReceiptOcrService();
const bankAdapter = createBankAdapterFromEnv();

const apiKey = process.env["API_KEY"];
const jwtSecret = process.env["JWT_SECRET"];
const fastify = await buildApp({
  repos,
  documentStorage,
  receiptOcr,
  bankAdapter,
  isProduction: isProd,
  enableDocs,
  corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  ...(metricsToken != null && { metricsToken }),
  ...(apiKey != null && { apiKey }),
  ...(jwtSecret != null && { jwtSecret }),
  fastifyOptions: {
    logger: isProd
      ? {
          level: "info",
          redact: {
            paths: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-api-key']"],
            censor: "[REDACTED]",
          },
        }
      : { level: "debug", transport: { target: "pino-pretty" } },
  },
});

// ------ Start server ------
const port = parseInt(process.env["PORT"] ?? "3000", 10);
const host = process.env["HOST"] ?? "0.0.0.0";

// ------ Graceful shutdown ------
const shutdown = async (signal: string) => {
  fastify.log.info(`${signal} received — shutting down gracefully`);
  try {
    await fastify.close();
    process.exit(0);
  } catch (err) {
    fastify.log.error(err, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

try {
  await fastify.listen({ port, host });
  console.log(`Server listening on http://${host}:${port} [${nodeEnv}]`);

  // Cleanup expired refresh tokens at startup
  const deleted = await repos.refreshTokens.cleanupExpired();
  if (deleted > 0) {
    fastify.log.info(`Cleaned up ${deleted} expired refresh token(s)`);
  }

  // Schedule daily cleanup of expired refresh tokens
  const cleanupInterval = setInterval(
    async () => {
      try {
        const n = await repos.refreshTokens.cleanupExpired();
        if (n > 0) fastify.log.info(`Scheduled cleanup: removed ${n} expired refresh token(s)`);
      } catch (err) {
        fastify.log.error(err, "Scheduled token cleanup failed");
      }
    },
    24 * 60 * 60 * 1000,
  );
  cleanupInterval.unref();

  // Schedule periodic bank sync for all CONNECTED connections across all organisations
  const bankSyncIntervalMs = parseInt(
    process.env["BANK_SYNC_INTERVAL_MS"] ?? String(6 * 60 * 60 * 1000),
    10,
  );
  const bankSyncInterval = setInterval(async () => {
    try {
      const orgs = await repos.organizations.findAll();
      for (const org of orgs) {
        const connections = await repos.bankConnections.findByOrganization(org.id);
        const connected = connections.filter((c) => c.status === "CONNECTED");
        for (const connection of connected) {
          try {
            const result = await fastify.bankSync.syncConnection({
              organizationId: org.id,
              connectionId: connection.id,
              trigger: "SCHEDULED",
            });
            fastify.log.info(
              { orgId: org.id, connectionId: connection.id, ...result },
              "Scheduled bank sync completed",
            );
          } catch (err) {
            fastify.log.error(
              { orgId: org.id, connectionId: connection.id, err },
              "Scheduled bank sync failed for connection",
            );
          }
        }
      }
    } catch (err) {
      fastify.log.error(err, "Scheduled bank sync sweep failed");
    }
  }, bankSyncIntervalMs);
  bankSyncInterval.unref();
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
