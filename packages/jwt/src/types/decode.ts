import { LevelOfAssurance } from "./loa";

export interface JwtDecodedClaims<Payload, Claims> {
  id: string;
  adjustedAccessLevel: LevelOfAssurance;
  audiences: Array<string>;
  authContextClass: Array<string>;
  authMethodsReference: Array<string>;
  authTime: number | null;
  authorizedParty: string | null;
  claims: Claims;
  levelOfAssurance: LevelOfAssurance;
  nonce: string | null;
  payload: Payload;
  permissions: Array<string>;
  scopes: Array<string>;
  sessionId: string | null;
  sessionHint: string | null;
  subject: string;
  subjectHint: string | null;
  type: string;
  username: string | null;
}

export interface JwtDecodeData<Payload, Claims> extends JwtDecodedClaims<Payload, Claims> {
  active: boolean;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  keyId: string;
  notBefore: number;
  now: number;
}
