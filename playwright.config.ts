import { defineConfig } from "@playwright/test";

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
    },
    {
      command: "pnpm --filter @muninsbok/web dev",
      port: 5173,
      reuseExistingServer: !!process.env["PLAYWRIGHT_REUSE_SERVER"],
      timeout: 30_000,
    },
  ],
});
