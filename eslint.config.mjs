// Minimal ESLint v9 flat config for the workspace.
import tseslint from '@typescript-eslint/parser';
import tsplugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
  },
  {
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      parser: tseslint,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsplugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
];
