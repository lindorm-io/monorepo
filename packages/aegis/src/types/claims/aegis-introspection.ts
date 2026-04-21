import type { LindormClaims } from "./lindorm-claims.js";
import type { OAuthClaims } from "./oauth-claims.js";
import type { OidcClaims } from "./oidc-claims.js";
import type { PopClaims } from "./pop-claims.js";
import type { DelegationClaims } from "./delegation-claims.js";
import type { StdClaims } from "./std-claims.js";

// When the token is active, the full claim surface is available.
// No individual claim is required per RFC 7662 §2.2 — all are MAY —
// but the claims are at least present as optional fields.
export type AegisIntrospectionActive = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  LindormClaims & {
    active: true;
    tokenType?: string;
    username?: string;
  };

// When the token is inactive, the response is just { active: false }.
// RFC 7662 §2.2: the server SHOULD NOT include additional information.
export type AegisIntrospectionInactive = {
  active: false;
};

// Discriminated union on `active`. Consumers must check `active` before
// reading claim fields — TS narrows to the correct branch.
export type AegisIntrospection = AegisIntrospectionActive | AegisIntrospectionInactive;
