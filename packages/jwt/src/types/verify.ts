import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export type JwtVerifyOptions = {
  adjustedAccessLevel?: AdjustedAccessLevel;
  atHash?: string;
  audience?: string;
  authorizedParty?: string;
  client?: string;
  clockTolerance?: number;
  issuer?: string;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string | number;
  nonce?: string;
  scopes?: string[];
  session?: string;
  subject?: string;
  subjectHints?: string[];
  tenant?: string;
  types?: string[];
};
