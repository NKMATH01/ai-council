import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/**",
      "*.config.*",
    ],
  },
  {
    rules: {
      // Allow unused vars with _ prefix (common React pattern)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      // Allow `any` — too much existing code uses it, fix gradually
      "@typescript-eslint/no-explicit-any": "off",
      // Allow empty catch blocks (used intentionally in streams)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Allow require() in CJS test scripts
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
