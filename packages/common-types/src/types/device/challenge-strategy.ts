import { ReverseMap } from "../utility";

export const ChallengeStrategies = {
  BIOMETRY: "biometry",
  IMPLICIT: "implicit",
  PINCODE: "pincode",
} as const;

export type ChallengeStrategy = ReverseMap<typeof ChallengeStrategies>;
