import { Expiry } from "@lindorm/date";
import { Dict } from "@lindorm/types";
import { TokenEncryptOrSignOptions } from "../header";
import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";
import { ActClaim, AuthFactor, SessionHint, SubjectHint } from "./jwt-claims";

export type SignJwtContent<C extends Dict = Dict> = {
  accessToken?: string;
  act?: ActClaim;
  adjustedAccessLevel?: AdjustedAccessLevel;
  audience?: Array<string>;
  authCode?: string;
  authContextClass?: string;
  authFactor?: Array<AuthFactor>;
  authMethods?: Array<string>;
  authorizedParty?: string;
  authState?: string;
  authTime?: Date;
  claims?: C;
  clientId?: string;
  entitlements?: Array<string>;
  expires: Expiry;
  grantType?: string;
  groups?: Array<string>;
  levelOfAssurance?: LevelOfAssurance;
  mayAct?: ActClaim;
  nonce?: string;
  notBefore?: Date;
  permissions?: Array<string>;
  roles?: Array<string>;
  scope?: Array<string>;
  sessionHint?: SessionHint;
  sessionId?: string;
  subject: string;
  subjectHint?: SubjectHint;
  tenantId?: string;
  tokenType: string;
};

export type SignJwtOptions = {
  accessTokenHash?: string;
  codeHash?: string;
  header?: TokenEncryptOrSignOptions;
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
