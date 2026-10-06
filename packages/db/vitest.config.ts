import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared.js";

export default defineConfig({
  test: {
    ...sharedTestConfig({
      thresholds: { statements: 60, branches: 50, functions: 60, lines: 60 },
      extraCoverageExcludes: ["src/client.ts"],
    }),
    environment: "node",
  },
});
