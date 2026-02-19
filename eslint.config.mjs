import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any — too noisy for existing codebase
      "@typescript-eslint/no-explicit-any": "off",
      // Allow non-null assertions (used with React refs & router params)
      "@typescript-eslint/no-non-null-assertion": "off",
      // Allow empty object types (used in Fastify route generics)
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow require-style imports in config files
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
