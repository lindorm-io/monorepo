import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { ParsedTokenHeader } from "../header";
import { Operators } from "../operators";
import { DecodedJwt } from "./jwt-decode";
import { ParsedJwtPayload } from "./jwt-parse";

export type VerifyJwtOptions = {
  accessToken?: string;
  adjustedAccessLevel?: Operators;
  audience?: Array<string> | string | Operators;
  authCode?: string;
  authContextClass?: string | Operators;
  authFactor?: string | Operators;
  authMethods?: Array<string> | string | Operators;
  authorizedParty?: string | Operators;
  authState?: string;
  authTime?: Operators;
  clientId?: Array<string> | string | Operators;
  grantType?: string | Operators;
  issuer?: string | Operators;
  levelOfAssurance?: number | Operators;
  nonce?: string | Operators;
  permissions?: Array<string> | string | Operators;
  roles?: Array<string> | string | Operators;
  scope?: Array<string> | string | Operators;
  sessionHint?: Array<string> | string | Operators;
  subject?: Array<string> | string | Operators;
  subjectHint?: string | Operators;
  tenantId?: Array<string> | string | Operators;
  tokenType?: string | Operators;
};

export type VerifiedJwtHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: "JWT";
};

export type VerifiedJwt<C extends Dict = Dict> = {
  decoded: DecodedJwt<C>;
  header: VerifiedJwtHeader;
  payload: ParsedJwtPayload<C>;
  token: string;
};
