import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import { markdownReaderBoundaryPlugin } from "./tools/eslint-rules/markdown-reader-boundaries.mjs";

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      ".corepack/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      ".pnpm-store/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,mts}"],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,mts}"],
  })),
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "markdown-reader-boundaries": markdownReaderBoundaryPlugin,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "markdown-reader-boundaries/domain-no-forbidden-imports": "error",
      "markdown-reader-boundaries/no-unsafe-inner-html": "error",
      "markdown-reader-boundaries/jsx-img-requires-alt": "error",
    },
  },
  {
    files: ["src/workers/**/*.ts"],
    languageOptions: {
      globals: globals.worker,
      parserOptions: {
        project: "./tsconfig.worker.json",
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      "*.config.ts",
      "eslint.config.mjs",
      "playwright.config.ts",
      "vite.config.ts",
      "vitest.config.ts",
      "tools/**/*.mjs",
    ],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx,mts,mjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.nodeBuiltin,
      },
    },
  },
);
