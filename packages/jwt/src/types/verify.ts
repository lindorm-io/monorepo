import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Algorithm } from "jsonwebtoken";
import { JwtDecode } from "./decode";

export type JwtVerifyOptions = {
  accessTokenHash?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  algorithms?: Algorithm[];
  audience?: string;
  authorizedParty?: string;
  client?: string;
  clockTolerance?: number;
  codeHash?: string;
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

export type JwtVerify<Claims = never> = JwtDecode<Claims>;
