import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from monorepo root (3 levels up from apps/api/src/)
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { prisma } from "@muninsbok/db";
import { buildApp } from "./app.js";
import { createRepositories } from "./repositories.js";

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

if (isProd && !process.env["API_KEY"]) {
  console.warn("VARNING: API_KEY är inte satt — API:et körs utan autentisering i produktion.");
}

// ------ Build app ------
const repos = createRepositories(prisma);

const apiKey = process.env["API_KEY"];
const fastify = await buildApp({
  repos,
  corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  ...(apiKey != null && { apiKey }),
  fastifyOptions: {
    logger: isProd ? { level: "info" } : { level: "debug", transport: { target: "pino-pretty" } },
  },
});

// ------ Start server ------
const port = parseInt(process.env["PORT"] ?? "3000", 10);
const host = process.env["HOST"] ?? "0.0.0.0";

try {
  await fastify.listen({ port, host });
  console.log(`Server listening on http://${host}:${port} [${nodeEnv}]`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
