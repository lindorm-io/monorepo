import { ReverseMap } from "../utility";

export const Environments = {
  PRODUCTION: "production",
  STAGING: "staging",
  DEVELOPMENT: "development",
  TEST: "test",
  UNKNOWN: "unknown",
} as const;

export type Environment = ReverseMap<typeof Environments>;
