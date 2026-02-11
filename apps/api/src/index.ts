import Fastify from "fastify";
import cors from "@fastify/cors";
import { organizationRoutes } from "./routes/organizations.js";
import { voucherRoutes } from "./routes/vouchers.js";
import { reportRoutes } from "./routes/reports.js";
import { sieRoutes } from "./routes/sie.js";
import { accountRoutes } from "./routes/accounts.js";

const fastify = Fastify({
  logger: true,
});

// Plugins
await fastify.register(cors, {
  origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
});

// Routes
await fastify.register(organizationRoutes, { prefix: "/api/organizations" });
await fastify.register(voucherRoutes, { prefix: "/api/organizations" });
await fastify.register(reportRoutes, { prefix: "/api/organizations" });
await fastify.register(sieRoutes, { prefix: "/api/organizations" });
await fastify.register(accountRoutes, { prefix: "/api/organizations" });

// Health check
fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Start server
const port = parseInt(process.env["PORT"] ?? "3000", 10);
const host = process.env["HOST"] ?? "0.0.0.0";

try {
  await fastify.listen({ port, host });
  console.log(`Server listening on http://${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
