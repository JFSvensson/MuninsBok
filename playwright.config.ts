import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Parse .env into a plain object (subset of dotenv syntax; does not touch process.env)
function parseEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const envFile = resolve(__dirname, ".env");
const dotenvVars = existsSync(envFile) ? parseEnvFile(envFile) : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm --filter @muninsbok/api dev",
      port: 3000,
      reuseExistingServer: !!process.env["PLAYWRIGHT_REUSE_SERVER"],
      timeout: 30_000,
      env: {
        ...dotenvVars,
        ...process.env,
        NODE_OPTIONS: "--no-deprecation",
      },
    },
    {
      command: "pnpm --filter @muninsbok/web dev",
      port: 5173,
      reuseExistingServer: !!process.env["PLAYWRIGHT_REUSE_SERVER"],
      timeout: 30_000,
      env: {
        ...dotenvVars,
        ...process.env,
        NODE_OPTIONS: "--no-deprecation",
      },
    },
  ],
});
