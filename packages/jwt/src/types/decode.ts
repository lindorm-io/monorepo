import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Algorithm } from "@lindorm-io/key-pair";

export type JwtDecodeAuth = {
  adjustedAccessLevel: AdjustedAccessLevel;
  authContextClass: string | null;
  authMethodsReference: Array<string>;
  authorizedParty: string | null;
  levelOfAssurance: LevelOfAssurance;
};

export type JwtDecodeKey = {
  id: string;
  algorithm: Algorithm;
  jwksUrl: string | null;
};

export type JwtDecodeMetadata = {
  accessTokenHash: string | null;
  authTime: number | null;
  codeHash: string | null;
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

export type JwtDecodePayload = {
  audiences: Array<string>;
  client: string | null;
  nonce: string | null;
  scopes: Array<string>;
  session: string | null;
  subject: string;
  tenant: string | null;
};

export type JwtDecode<Claims = Record<string, never>> = {
  id: string;
  active: boolean;
  auth: JwtDecodeAuth;
  claims: Claims;
  key: JwtDecodeKey;
  metadata: JwtDecodeMetadata;
  payload: JwtDecodePayload;
  token: string;
};
