import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { Algorithm } from "@lindorm-io/key-pair";

export type JwtDecodeClaims<Claims = Record<string, never>> = {
  adjustedAccessLevel: AdjustedAccessLevel;
  audiences: Array<string>;
  authContextClass: string | null;
  authMethodsReference: Array<string>;
  authorizedParty: string | null;
  client: string | null;
  levelOfAssurance: LevelOfAssurance;
  scopes: Array<string>;
  session: string | null;
  subject: string;
  tenant: string | null;
  username: string | null;
} & Claims;

export type JwtDecodeMetadata = {
  active: boolean;
  algorithm: Algorithm;
  atHash: string | null;
  authTime: number | null;
  expires: number;
  expiresIn: number;
  issuedAt: number;
  issuer: string;
  jwksUrl: string | null;
  keyId: string;
  nonce: string | null;
  notBefore: number;
  now: number;
  sessionHint: string | null;
  subjectHint: string | null;
  type: string;
};

export type JwtDecodeResult<Claims = Record<string, never>> = {
  id: string;
  claims: JwtDecodeClaims<Claims>;
  metadata: JwtDecodeMetadata;
  token: string;
};
