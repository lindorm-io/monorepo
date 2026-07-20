import type {
  DelegationClaims,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  RarClaims,
  StdClaims,
} from "@lindorm/aegis";

// OAuth 2.0 token introspection (RFC 7662) response as resolved by
// ctx.auth.introspect(). Pylon owns this shape (moved out of @lindorm/aegis);
// the claim surface reuses the Aegis domain-claim types.
//
// When the token is active, the full claim surface is available. No individual
// claim is required per RFC 7662 §2.2 — all are MAY — but the claims are at
// least present as optional fields.
export type PylonIntrospectionActive = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  RarClaims &
  LindormClaims & {
    active: true;
    tokenType?: string;
    username?: string;
  };

// When the token is inactive, the response is just { active: false }.
// RFC 7662 §2.2: the server SHOULD NOT include additional information.
export type PylonIntrospectionInactive = {
  active: false;
};

// Discriminated union on `active`. Consumers must check `active` before
// reading claim fields — TS narrows to the correct branch.
export type PylonIntrospection = PylonIntrospectionActive | PylonIntrospectionInactive;
