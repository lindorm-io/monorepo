import { ReverseMap } from "../utility";

export const ChallengeStrategyEnum = {
  BIOMETRY: "biometry",
  IMPLICIT: "implicit",
  PINCODE: "pincode",
} as const;

export type ChallengeStrategy = ReverseMap<typeof ChallengeStrategyEnum>;
