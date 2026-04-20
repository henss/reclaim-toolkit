// Managed by llm-orchestrator TypeScript agent-surface standard.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**", ".runtime/**", ".sandbox-tmp/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "preserve-caught-error": "warn",
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-lines": ["warn", { max: 550, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 120, skipBlankLines: true, skipComments: true }],
      "max-params": ["warn", 5],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports so agents can grep and refactor call sites reliably.",
        },
      ],
    },
  },
  {
    files: [
      "**/*.config.ts",
      "**/*.config.tsx",
      "**/vite.config.ts",
      "**/vitest.config.ts",
      "**/next.config.ts",
      "**/playwright.config.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
