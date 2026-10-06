import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared.js";

export default defineConfig({
  test: {
    ...sharedTestConfig({
      thresholds: { statements: 80, branches: 70, functions: 75, lines: 80 },
      extraCoverageExcludes: ["src/test/**"],
    }),
    environment: "node",
  },
});
