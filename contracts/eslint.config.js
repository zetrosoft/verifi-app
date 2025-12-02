import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    // Common ignores
    ignores: ['node_modules/', 'dist/', 'coverage/', 'typechain-types/', 'artifacts/', 'cache/'],
  },
  // Basic JS rules
  pluginJs.configs.recommended,
  // Prettier integration
  prettierRecommended,
  {
    // Global language options (applies to all files unless overridden)
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Type-aware linting for TypeScript files only
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // Specify tsconfig for type-aware linting
      },
    },
    rules: {
      // Custom TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Often useful in tests or for quick prototyping
    },
  },
  {
    // Rules specific to JS files
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
);
