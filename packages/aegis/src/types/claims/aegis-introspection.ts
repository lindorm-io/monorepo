import { LindormClaims } from "./lindorm-claims";
import { OAuthClaims } from "./oauth-claims";
import { OidcClaims } from "./oidc-claims";
import { PopClaims } from "./pop-claims";
import { DelegationClaims } from "./delegation-claims";
import { StdClaims } from "./std-claims";

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
