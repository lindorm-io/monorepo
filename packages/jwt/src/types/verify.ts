import { OpenIdGrantType } from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { JwtDecode } from "./decode";
import { JwtAlg } from "./types";

export type JwtVerifyOptions = {
  accessTokenHash?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  algorithms?: JwtAlg[];
  audience?: string;
  authorizedParty?: string;
  client?: string;
  clockTolerance?: number;
  codeHash?: string;
  grantType?: OpenIdGrantType;
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
