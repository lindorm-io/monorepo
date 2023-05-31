import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Expiry } from "@lindorm-io/expiry";
import { KeyType } from "@lindorm-io/key-pair";

export type JwtSignOptions<Claims = Record<string, never>> = {
  id?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  atHash?: string;
  audiences: Array<string>;
  authContextClass?: string;
  authMethodsReference?: Array<string>;
  authorizedParty?: string;
  authTime?: number;
  claims?: Claims;
  client?: string;
  expiry: Expiry;
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
  username?: string;
};

export type JwtSignResult = {
  id: string;
  expires: Date;
  expiresIn: number;
  expiresUnix: number;
  token: string;
};
