import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Next 16 removed `next lint`; setup follows node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ponytail: usePlan, useShoppingList and RecipeList fetch inside useEffect and set loading state there.
      // Warn until those hooks are refactored (see docs/wiki/references/known-gaps.md), then make it an error again.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.bench-chrome/**']),
]);
