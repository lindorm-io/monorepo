import { ReverseMap } from "../utility";

export const PSD2Factors = {
  INHERENCE: "inherence",
  KNOWLEDGE: "knowledge",
  POSSESSION: "possession",
} as const;

export type PSD2Factor = ReverseMap<typeof PSD2Factors>;
