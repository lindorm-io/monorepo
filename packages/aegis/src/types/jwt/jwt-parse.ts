import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { ParsedTokenHeader } from "../header";
import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";
import { DecodedJwt } from "./jwt-decode";

export type ParsedJwtHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: "JWT";
};

export type ParsedJwtPayload<C extends Dict = Dict> = {
  accessTokenHash: string | undefined;
  adjustedAccessLevel: AdjustedAccessLevel | undefined;
  audience: Array<string>;
  authContextClass: string | undefined;
  authFactor: string | undefined;
  authMethods: Array<string>;
  authorizedParty: string | undefined;
  authTime: Date | undefined;
  claims: C;
  clientId: string | undefined;
  codeHash: string | undefined;
  expiresAt: Date | undefined;
  grantType: string | undefined;
  issuedAt: Date | undefined;
  issuer: string;
  levelOfAssurance: LevelOfAssurance | undefined;
  nonce: string | undefined;
  notBefore: Date | undefined;
  permissions: Array<string>;
  roles: Array<string>;
  scope: Array<string>;
  sessionHint: string | undefined;
  sessionId: string | undefined;
  stateHash: string | undefined;
  subject: string;
  subjectHint: string | undefined;
  tenantId: string | undefined;
  tokenId: string;
  tokenType: string;
};

export type ParsedJwt<C extends Dict = Dict> = {
  decoded: DecodedJwt<C>;
  header: ParsedJwtHeader;
  payload: ParsedJwtPayload<C>;
  token: string;
};
