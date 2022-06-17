import { LevelOfAssurance } from "./loa";

export interface JwtVerifyOptions {
  adjustedAccessLevel: LevelOfAssurance;
  audience: string;
  audiences: Array<string>;
  authorizedParty: string;
  clockTolerance: number;
  issuer: string;
  levelOfAssurance: LevelOfAssurance;
  maxAge: string;
  nonce: string;
  permissions: Array<string>;
  scopes: Array<string>;
  subject: string;
  subjectHint: string;
  subjects: Array<string>;
  types: Array<string>;
}

export interface JwtVerifyData<Payload = never, Claims = never> {
  id: string;
  active: boolean;
  adjustedAccessLevel: LevelOfAssurance;
  audiences: Array<string>;
  authContextClass: Array<string>;
  authMethodsReference: Array<string>;
  authTime: number | null;
  authorizedParty: string | null;
  claims: Claims;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  levelOfAssurance: LevelOfAssurance;
  nonce: string | null;
  notBefore: number;
  now: number;
  payload: Payload;
  permissions: Array<string>;
  scopes: Array<string>;
  sessionId: string | null;
  sessionHint: string | null;
  subject: string;
  subjectHint: string | null;
  token: string;
  type: string;
  username: string | null;
}
