import { OpenIdGrantType } from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { JwtDecode } from "./decode";
import { JwtAlg } from "./types";

export type JwtVerifyOptions = {
  accessTokenHash?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  algorithms?: Array<JwtAlg>;
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
  roles?: Array<string>;
  scopes?: Array<string>;
  secret?: string;
  session?: string;
  subject?: string;
  subjectHints?: Array<string>;
  tenant?: string;
  types?: Array<string>;
};

export type JwtVerify<Claims = never> = JwtDecode<Claims>;
