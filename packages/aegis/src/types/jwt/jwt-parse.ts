import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import type {
  AegisProfile,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  DelegationClaims,
  StdClaims,
} from "../claims/index.js";
import type { RefinedTokenHeader } from "../header.js";
import type { DecodedJwt } from "./jwt-decode.js";
import type { TokenDelegation } from "./jwt-delegation.js";
import type { ParsedDpopProof } from "./jwt-dpop.js";

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
