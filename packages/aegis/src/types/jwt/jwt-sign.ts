import { Expiry } from "@lindorm/date";
import { Dict } from "@lindorm/types";
import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";

export type SignJwtContent<C extends Dict = Dict> = {
  accessToken?: string;
  adjustedAccessLevel?: AdjustedAccessLevel;
  audience?: Array<string>;
  authCode?: string;
  authContextClass?: string;
  authFactor?: string;
  authMethods?: Array<string>;
  authorizedParty?: string;
  authState?: string;
  authTime?: Date;
  claims?: C;
  clientId?: string;
  expires: Expiry;
  grantType?: string;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
  notBefore?: Date;
  permissions?: Array<string>;
  roles?: Array<string>;
  scope?: Array<string>;
  sessionHint?: string;
  sessionId?: string;
  subject: string;
  subjectHint?: string;
  tenantId?: string;
  tokenType: string;
};

export type SignJwtOptions = {
  accessTokenHash?: string;
  codeHash?: string;
  issuedAt?: Date;
  objectId?: string;
  stateHash?: string;
  tokenId?: string;
};

export type SignedJwt = {
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  objectId: string;
  token: string;
  tokenId: string;
};
