import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import { rules } from './rules.mjs';

const plugin = { meta: { name: '@tsquid/eslint-plugin' }, rules, configs: {} };

// Flat config for a tsquid app's src/. main.tsx is the bootstrap exception: it performs
// imperative initialization rather than declaring a reusable UI module.
plugin.configs.recommended = [
  { ignores: ['**/__generated__/**', 'dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { tsquid: plugin, 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'tsquid/module-order': 'error',
      'tsquid/constant-names': 'error',
      'tsquid/module-exports': 'error',
      'tsquid/local-component-names': 'error',
      'tsquid/render-only-components': 'error',
    },
  },
  {
    files: ['src/main.tsx'],
    rules: { 'tsquid/module-order': 'off', 'tsquid/constant-names': 'off', 'tsquid/local-component-names': 'off' },
  },
];

export default plugin;
