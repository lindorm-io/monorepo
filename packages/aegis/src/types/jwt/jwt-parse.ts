import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { ParsedTokenHeader } from "../header";
import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";
import { DecodedJwt } from "./jwt-decode";
import { AegisProfile } from "./aegis-profile";
import {
  ActClaim,
  AuthFactor,
  SessionHint,
  SubjectHint,
  TokenDelegation,
} from "./jwt-claims";

export type ParsedJwtHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: string;
};

export type ParsedJwtPayload<C extends Dict = Dict> = {
  accessTokenHash: string | undefined;
  act: ActClaim | undefined;
  adjustedAccessLevel: AdjustedAccessLevel | undefined;
  audience: Array<string>;
  authContextClass: string | undefined;
  authFactor: Array<AuthFactor> | undefined;
  authMethods: Array<string>;
  authorizedParty: string | undefined;
  authTime: Date | undefined;
  claims: C;
  clientId: string | undefined;
  codeHash: string | undefined;
  entitlements: Array<string>;
  expiresAt: Date | undefined;
  grantType: string | undefined;
  groups: Array<string>;
  issuedAt: Date | undefined;
  issuer: string;
  levelOfAssurance: LevelOfAssurance | undefined;
  mayAct: ActClaim | undefined;
  nonce: string | undefined;
  notBefore: Date | undefined;
  permissions: Array<string>;
  profile: AegisProfile | undefined;
  roles: Array<string>;
  scope: Array<string>;
  sessionHint: SessionHint | undefined;
  sessionId: string | undefined;
  stateHash: string | undefined;
  subject: string;
  subjectHint: SubjectHint | undefined;
  tenantId: string | undefined;
  tokenId: string;
};

export type ParsedJwt<C extends Dict = Dict> = {
  decoded: DecodedJwt<C>;
  delegation: TokenDelegation;
  header: ParsedJwtHeader;
  payload: ParsedJwtPayload<C>;
  token: string;
};
