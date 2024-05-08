export const TEST_STRINGS = [
  "camelCase",
  "Capital Case",
  "CONSTANT_CASE",
  "dot.case",
  "kebab-case",
  "lower case",
  "PascalCase",
  "path/case",
  "Sentence case",
  "snake_case",
];

export const INVALID_INPUT: Array<{ type: string; value: any }> = [
  { type: "number", value: 1234 },
  { type: "error", value: new Error("error") },
  { type: "date", value: new Date() },
  { type: "null", value: null },
  { type: "undefined", value: undefined },
];
