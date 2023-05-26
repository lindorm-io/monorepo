import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export type JwtDecodedClaims<Claims = never> = {
  id: string;
  active: boolean;
  adjustedAccessLevel: AdjustedAccessLevel;
  atHash: string | null;
  audiences: Array<string>;
  authContextClass: string | null;
  authMethodsReference: Array<string>;
  authorizedParty: string | null;
  authTime: number | null;
  claims: Claims;
  client: string | null;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  keyId: string;
  levelOfAssurance: LevelOfAssurance;
  nonce: string | null;
  notBefore: number;
  now: number;
  scopes: Array<string>;
  session: string | null;
  sessionHint: string | null;
  subject: string;
  subjectHint: string | null;
  tenant: string | null;
  token: string;
  type: string;
  username: string | null;
};

export type JwtDecodeData<Claims = never> = JwtDecodedClaims<Claims> & {
  active: boolean;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  keyId: string;
  notBefore: number;
  now: number;
};
