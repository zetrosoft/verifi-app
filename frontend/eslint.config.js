import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'vite.config.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module', // Add sourceType for ES Modules
      globals: globals.browser,
      parserOptions: { // Add parserOptions for TypeScript
        project: ['tsconfig.json', 'tsconfig.app.json'],
      },
    },
    rules: {
      // Custom rules for prototype development
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' for faster prototyping
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', // Ignore unused arguments starting with _
        varsIgnorePattern: '^_', // Ignore unused variables starting with _
        caughtErrorsIgnorePattern: '^_', // Ignore unused caught error variables starting with _
        ignoreRestSiblings: true,
      }],
      'react-refresh/only-export-components': 'warn', // Change to warn to avoid breaking HMR
    },
  },
])
