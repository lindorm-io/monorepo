import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export type JwtDecodedClaims<Payload = never, Claims = never> = {
  id: string;
  active: boolean;
  adjustedAccessLevel: AdjustedAccessLevel;
  audiences: Array<string>;
  authContextClass: Array<string>;
  authMethodsReference: Array<string>;
  authTime: number | null;
  authorizedParty: string | null;
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
  payload: Payload;
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

export type JwtDecodeData<Payload = never, Claims = never> = JwtDecodedClaims<Payload, Claims> & {
  active: boolean;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  keyId: string;
  notBefore: number;
  now: number;
};
