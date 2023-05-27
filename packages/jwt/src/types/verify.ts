import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Algorithm } from "jsonwebtoken";

export type JwtVerifyOptions = {
  adjustedAccessLevel?: AdjustedAccessLevel;
  algorithms?: Algorithm[];
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
  secret?: string;
  session?: string;
  subject?: string;
  subjectHints?: string[];
  tenant?: string;
  types?: string[];
};
