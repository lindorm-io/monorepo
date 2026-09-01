import { isString } from "@lindorm/is";
import type { Environment } from "@lindorm/types";

// The sanctioned deployment environments (the `Environment` union from
// @lindorm/types). Carried on certificates via the OU DN attribute.
export const ENVIRONMENTS: ReadonlyArray<Environment> = [
  "production",
  "staging",
  "development",
  "test",
  "unknown",
];

export const isEnvironment = (value: unknown): value is Environment =>
  isString(value) && (ENVIRONMENTS as ReadonlyArray<string>).includes(value);
