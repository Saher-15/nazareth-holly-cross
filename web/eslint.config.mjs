import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Conventions of the site that the linter enforces (see docs/ENGINEERING.md and docs/REVIEW.md):
//  - every visible string goes through next-intl, never into the JSX;
//  - components are named, so they show up in React DevTools and stack traces;
//  - imports are ordered: libraries, then "@/" modules, then the files next to this one.
// Raw colours and font names in CSS are checked by tests/unit/conventions.test.ts.
const LETTER = "[\\p{L}]";
const ATTRIBUTES = "alt|aria-label|aria-description|aria-roledescription|aria-placeholder|title|placeholder";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXText[value=/${LETTER}/u]`,
          message: "Visible text belongs in src/messages/*.json (use useTranslations / getTranslations), not in the JSX.",
        },
        {
          selector: `JSXElement > JSXExpressionContainer > Literal[value=/${LETTER}/u]`,
          message: "Visible text belongs in src/messages/*.json (use useTranslations / getTranslations), not in the JSX.",
        },
        {
          selector: `JSXAttribute[name.name=/^(${ATTRIBUTES})$/] > Literal[value=/${LETTER}/u]`,
          message: "Text read by people (alt, aria-label, title, placeholder) belongs in src/messages/*.json.",
        },
        {
          selector: "ExportDefaultDeclaration > ArrowFunctionExpression",
          message: "Give the default export a name: export default function Name() {}",
        },
        {
          selector: "ExportDefaultDeclaration > FunctionExpression",
          message: "Give the default export a name: export default function Name() {}",
        },
        {
          selector: "ExportDefaultDeclaration > FunctionDeclaration[id=null]",
          message: "Give the default export a name: export default function Name() {}",
        },
        {
          selector: "ExportDefaultDeclaration > ClassDeclaration[id=null]",
          message: "Give the default export a name.",
        },
      ],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin", "external"],
          "newlines-between": "ignore",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
