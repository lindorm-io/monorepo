module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"],
    ecmaVersion: 2021,
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: {
    browser: true,
    es6: true,
    node: true,
    serviceworker: true,
  },
  globals: {
    Promise: "readonly",
  },
  ignorePatterns: [
    "*.config.js",
    "*.d.ts",
    "*.integration.*",
    "*.test.ts",
    "*.js",
    "build",
    "node_modules",
  ],
  rules: {
    "comma-dangle": ["error", "always-multiline"],
    "@typescript-eslint/ban-ts-comment": 0,
    "@typescript-eslint/explicit-member-accessibility": ["error"],
    "@typescript-eslint/explicit-function-return-type": ["warn"],
    "@typescript-eslint/no-explicit-any": 0,
  },
};
