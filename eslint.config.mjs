// ESLint flat config for Next.js 16 / ESLint 9.
// Replaces the legacy .eslintrc.json. Both eslint-config-next subpaths
// (`./core-web-vitals` and `./typescript`) ship native flat configs in v16.

import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "tools/**",
      "tests/**",
      "playwright.config.ts",
      "prisma/seed.ts",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  {
    // Relax newly-introduced react-hooks@7 / React 19 strict rules so the
    // Next 14 → 16 upgrade can land without an unrelated component refactor.
    // These flag pre-existing patterns (setState-in-effect, ref-during-render)
    // that are real but non-blocking. Track follow-up cleanup separately.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      // Newly-strict rules from typescript-eslint@8 / next-config@16 that
      // weren't enforced under Next 14. Keep them as warnings so the Next 16
      // upgrade lands clean; promote back to "error" in a follow-up sweep.
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];
