import { OpenIdGrantType } from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { KeySetAlgorithm } from "@lindorm-io/jwk";

export type JwtDecodeKey = {
  id: string;
  algorithm: KeySetAlgorithm;
  jwksUrl: string | null;
};

export type JwtDecodeMetadata = {
  accessTokenHash: string | null;
  active: boolean;
  adjustedAccessLevel: AdjustedAccessLevel;
  audiences: Array<string>;
  authContextClass: string | null;
  authFactorReference: string | null;
  authMethodsReference: Array<string>;
  authorizedParty: string | null;
  authTime: number | null;
  client: string | null;
  codeHash: string | null;
  expires: number;
  expiresIn: number;
  grantType: OpenIdGrantType | null;
  issuedAt: number;
  issuer: string;
  levelOfAssurance: LevelOfAssurance;
  nonce: string | null;
  notBefore: number;
  now: number;
  roles: Array<string>;
  scopes: Array<string>;
  session: string | null;
  sessionHint: string | null;
  subjectHint: string | null;
  tenant: string | null;
  type: string;
};

export type JwtDecode<Claims = Record<string, never>> = {
  id: string;
  claims: Claims;
  key: JwtDecodeKey;
  metadata: JwtDecodeMetadata;
  subject: string;
  token: string;
};
