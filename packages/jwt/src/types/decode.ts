import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Algorithm } from "@lindorm-io/key-pair";

export type JwtDecodeAuth = {
  accessTokenHash: string | null;
  adjustedAccessLevel: AdjustedAccessLevel;
  authContextClass: string | null;
  authMethodsReference: Array<string>;
  authorizedParty: string | null;
  codeHash: string | null;
  levelOfAssurance: LevelOfAssurance;
  nonce: string | null;
};

export type JwtDecodeClaims<Claims = Record<string, never>> = Claims & {
  audiences: Array<string>;
  client: string | null;
  scopes: Array<string>;
  session: string | null;
  subject: string;
  tenant: string | null;
  username: string | null;
};

export type JwtDecodeKey = {
  algorithm: Algorithm;
  jwksUrl: string | null;
  keyId: string;
};

export type JwtDecodeMetadata = {
  authTime: number | null;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  notBefore: number;
  now: number;
  sessionHint: string | null;
  subjectHint: string | null;
  type: string;
};

export type JwtDecode<Claims = Record<string, never>> = {
  id: string;
  active: boolean;
  auth: JwtDecodeAuth;
  claims: JwtDecodeClaims<Claims>;
  key: JwtDecodeKey;
  metadata: JwtDecodeMetadata;
  token: string;
};
