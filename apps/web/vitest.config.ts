import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared.js";

export default defineConfig({
  test: {
    ...sharedTestConfig({
      extensions: ["ts", "tsx"],
      thresholds: { statements: 30, branches: 30, functions: 30, lines: 30 },
      extraCoverageExcludes: ["src/vite-env.d.ts"],
    }),
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
