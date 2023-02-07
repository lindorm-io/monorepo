import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export type JwtVerifyOptions = {
  adjustedAccessLevel?: AdjustedAccessLevel;
  audience?: string;
  audiences?: Array<string>;
  authorizedParty?: string;
  clockTolerance?: number;
  issuer?: string;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string;
  nonce?: string;
  scopes?: Array<string>;
  subject?: string;
  subjectHint?: string;
  subjects?: Array<string>;
  tenantId?: string;
  types?: Array<string>;
};
