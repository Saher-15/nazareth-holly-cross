import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// The admin keeps its visible text in src/i18n (English, Hebrew, Arabic), so the conventions here are:
// named default exports and ordered imports. Raw colours and fonts live only in src/styles/tokens.css.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Product photos are arbitrary Firebase/https addresses chosen in the form; the image optimiser is not used.
      '@next/next/no-img-element': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration > ArrowFunctionExpression',
          message: 'Give the default export a name: export default function Name() {}',
        },
        {
          selector: 'ExportDefaultDeclaration > FunctionDeclaration[id=null]',
          message: 'Give the default export a name: export default function Name() {}',
        },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin', 'external'],
          'newlines-between': 'ignore',
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'mock-api/**', 'playwright-report/**', 'test-results/**']),
]);

export default eslintConfig;
