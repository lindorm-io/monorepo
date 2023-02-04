import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export type JwtVerifyOptions = {
  adjustedAccessLevel: AdjustedAccessLevel;
  audience: string;
  audiences: Array<string>;
  authorizedParty: string;
  clockTolerance: number;
  issuer: string;
  levelOfAssurance: LevelOfAssurance;
  maxAge: string;
  nonce: string;
  scopes: Array<string>;
  subject: string;
  subjectHint: string;
  subjects: Array<string>;
  types: Array<string>;
};

export type JwtVerifyData<Payload = never, Claims = never> = {
  id: string;
  active: boolean;
  adjustedAccessLevel: AdjustedAccessLevel;
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
  scopes: Array<string>;
  sessionId: string | null;
  sessionHint: string | null;
  subject: string;
  subjectHint: string | null;
  token: string;
  type: string;
  username: string | null;
};
