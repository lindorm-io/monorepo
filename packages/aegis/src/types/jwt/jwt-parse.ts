import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import {
  AegisProfile,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  DelegationClaims,
  StdClaims,
} from "../claims";
import { RefinedTokenHeader } from "../header";
import { DecodedJwt } from "./jwt-decode";
import { TokenDelegation } from "./jwt-delegation";
import { ParsedDpopProof } from "./jwt-dpop";

export type ParsedJwtHeader = RefinedTokenHeader<KryptosSigAlgorithm>;

export type ParsedJwtPayload<C extends Dict = Dict> = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  LindormClaims & {
    audience: Array<string>;
    authMethods: Array<string>;
    claims: C;
    entitlements: Array<string>;
    groups: Array<string>;
    issuer: string;
    permissions: Array<string>;
    profile: AegisProfile | undefined;
    roles: Array<string>;
    scope: Array<string>;
    subject: string;
    tokenId: string;
  };

export type ParsedJwt<C extends Dict = Dict> = {
  decoded: DecodedJwt<C>;
  delegation: TokenDelegation;
  dpop?: ParsedDpopProof;
  header: ParsedJwtHeader;
  payload: ParsedJwtPayload<C>;
  token: string;
};
