import nextConfig from 'eslint-config-next/core-web-vitals';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Herda a config flat do Next 16 (inclui React, React Hooks, JSX A11y, TS-ESLint)
  ...nextConfig,

  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/backups/**',
    ],
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      prettier: prettierPlugin,
      import: importPlugin,
    },
    rules: {
      'prettier/prettier': 'error',

      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',

      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'import/no-duplicates': 'error',

      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },

  // Testes: relaxa any (mocks) e permite console.log de debug
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  prettierConfig,
];
