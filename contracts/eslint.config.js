import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
// import hardhatPlugin from "@nomiclabs/eslint-plugin-hardhat"; // Cannot include this due to installation issues

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "typechain-types/",
      "artifacts/",
      "cache/",
    ],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended, // Integrate Prettier
  // hardhatPlugin.configs.recommended, // Cannot include this due to installation issues
  {
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // Specify tsconfig for type-aware linting
      },
    },
    rules: {
      // Add custom rules here
      // 'prettier/prettier': 'error', // Handled by prettierRecommended
      // '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);