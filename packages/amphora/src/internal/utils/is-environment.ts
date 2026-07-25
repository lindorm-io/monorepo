import type { Environment } from "@lindorm/types";

// The sanctioned deployment environments (the `Environment` union). A leaf
// certificate carries one via its subject OU (organizationalUnitName).
const ENVIRONMENTS: ReadonlyArray<Environment> = [
  "production",
  "staging",
  "development",
  "test",
  "unknown",
];

export const isEnvironment = (value: unknown): value is Environment =>
  typeof value === "string" && (ENVIRONMENTS as ReadonlyArray<string>).includes(value);
