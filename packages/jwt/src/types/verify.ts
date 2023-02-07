import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export type JwtVerifyOptions = {
  adjustedAccessLevel?: AdjustedAccessLevel;
  audience?: string;
  authorizedParty?: string;
  clockTolerance?: number;
  issuer?: string;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string | number;
  nonce?: string;
  scopes?: string[];
  subject?: string;
  subjectHints?: string[];
  tenant?: string;
  types?: string[];
};
