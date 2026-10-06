// Load .env from monorepo root (Node built-in; does not override existing env vars)
process.loadEnvFile("../../.env");

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
