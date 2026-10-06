/**
 * Shared Vitest configuration for the monorepo.
 *
 * Each package's vitest.config.ts spreads this factory's result and only
 * overrides what differs (environment, setupFiles, coverage thresholds,
 * extra excludes). Keeps the v8 coverage conventions in one place.
 */
import type { TestUserConfig } from "vitest/node";

export interface SharedTestOptions {
  /** File extensions to include for tests and coverage (e.g. ["ts"] or ["ts", "tsx"]). */
  extensions?: readonly string[];
  /** Coverage thresholds (percentages). */
  thresholds: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  /** Extra coverage exclusions beyond the defaults. */
  extraCoverageExcludes?: string[];
}

export function sharedTestConfig(options: SharedTestOptions): TestUserConfig {
  const extensions = options.extensions ?? (["ts"] as const);
  return {
    include: extensions.map((ext) => `src/**/*.test.${ext}`),
    coverage: {
      provider: "v8",
      include: extensions.map((ext) => `src/**/*.${ext}`),
      exclude: [
        "src/**/index.ts",
        ...extensions.map((ext) => `src/**/*.test.${ext}`),
        ...(options.extraCoverageExcludes ?? []),
      ],
      thresholds: options.thresholds,
    },
  };
}
