import { prisma } from "@muninsbok/db";
import { buildApp } from "./app.js";
import { createRepositories } from "./repositories.js";

const repos = createRepositories(prisma);

const fastify = await buildApp({
  repos,
  corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  fastifyOptions: { logger: true },
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
