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
    "__fixtures__",
    "__mocks__",
    "*.d.ts",
    "*.fixture.*",
    "*.integration.*",
    "*.js",
    "*.test.ts",
    "build",
    "node_modules",
    "package*.json",
  ],
  rules: {
    "@typescript-eslint/ban-ts-comment": 0,
    "@typescript-eslint/explicit-function-return-type": ["warn"],
    "@typescript-eslint/explicit-member-accessibility": ["error"],
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        args: "after-used",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
        vars: "all",
      },
    ],
    "comma-dangle": ["error", "always-multiline"],
  },
};
