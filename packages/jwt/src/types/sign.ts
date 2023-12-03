import { OpenIdGrantType } from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Expiry } from "@lindorm-io/expiry";
import { KeyType } from "@lindorm-io/key-pair";

export type JwtSignOptions<Claims = Record<string, never>> = {
  id?: string;
  accessToken?: string;
  accessTokenHash?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  audiences: Array<string>;
  authContextClass?: string;
  authFactorReference?: string;
  authMethodsReference?: Array<string>;
  authorizedParty?: string;
  authTime?: number;
  claims?: Claims;
  client?: string;
  code?: string;
  codeHash?: string;
  expiry: Expiry;
  grantType?: OpenIdGrantType;
  issuedAt?: Date;
  jwksUrl?: string;
  keyType?: KeyType;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
  notBefore?: Date;
  scopes?: Array<string>;
  session?: string;
  sessionHint?: string;
  subject: string;
  subjectHint?: string;
  tenant?: string;
  type: string;
};

export type JwtSign = {
  id: string;
  expires: Date;
  expiresIn: number;
  expiresUnix: number;
  token: string;
};
