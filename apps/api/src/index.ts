import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from monorepo root (3 levels up from apps/api/src/)
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { prisma } from "@muninsbok/db";
import { buildApp } from "./app.js";
import { createRepositories } from "./repositories.js";
import { DocumentStorage } from "./services/document-storage.js";

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

if (isProd && !process.env["JWT_SECRET"]) {
  console.warn(
    "VARNING: JWT_SECRET är inte satt — API:et körs utan användarautentisering i produktion!",
  );
  console.warn(
    "Generera en hemlighet: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

if (isProd && !process.env["JWT_SECRET"] && !process.env["API_KEY"]) {
  console.warn("VARNING: Varken JWT_SECRET eller API_KEY är satt — API:et är helt oskyddat!");
}

// ------ Build app ------
const repos = createRepositories(prisma);
const documentStorage = new DocumentStorage();

const apiKey = process.env["API_KEY"];
const jwtSecret = process.env["JWT_SECRET"];
const fastify = await buildApp({
  repos,
  documentStorage,
  corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  ...(apiKey != null && { apiKey }),
  ...(jwtSecret != null && { jwtSecret }),
  fastifyOptions: {
    logger: isProd ? { level: "info" } : { level: "debug", transport: { target: "pino-pretty" } },
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
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
