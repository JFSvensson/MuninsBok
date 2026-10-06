// Load .env from monorepo root when it exists (Node built-in; does not
// override existing env vars). Skipped in CI where .env is absent.
import { existsSync } from "node:fs";

if (existsSync("../../.env")) {
  process.loadEnvFile("../../.env");
}

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
