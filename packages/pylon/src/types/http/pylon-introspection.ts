import type {
  DelegationClaims,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  RarClaims,
  StdClaims,
} from "@lindorm/aegis";
import type { Dict } from "@lindorm/types";

// OAuth 2.0 token introspection (RFC 7662) response as resolved by
// ctx.auth.introspect(). Pylon owns this shape (moved out of @lindorm/aegis);
// the claim surface reuses the Aegis domain-claim types.
//
// When the token is active, the full claim surface is available. No individual
// claim is required per RFC 7662 §2.2 — all are MAY — but the claims are at
// least present as optional fields.
//
// The REGISTERED claims stay flat; everything the aegis registry does not know
// sits nested in `custom`. Keeping the two apart here is what lets
// `ctx.state.access` publish them apart without a use-time consumer re-deriving
// the split from the registry — aegis already made it at the boundary.
//
// ⚠ `custom` is therefore RESERVED at the top level. An authorization server is
// free to return a member literally named `custom` (RFC 7662 §2.2 permits any),
// and it is not lost and not ambiguous: `custom` is not a registered claim, so
// the translator routes it into the bucket like every other unregistered key
// and it surfaces at `introspection.custom.custom`. Reading `.custom` always
// yields the bucket, never a raw claim value.
export type PylonIntrospectionActive = StdClaims &
  OidcClaims &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  RarClaims &
  LindormClaims & {
    active: true;
    /** Always an object — `{}` when the token carried no unregistered claims. */
    custom: Dict;
    /**
     * RFC 7662 §2.2 `token_type`. Declared here rather than drawn from the aegis
     * claim types because it describes the ANSWER, not the token — unlike
     * `username`, which IS a registered claim and arrives via `OAuthClaims`.
     */
    tokenType?: string;
  };

// When the token is inactive, the response is just { active: false }.
// RFC 7662 §2.2: the server SHOULD NOT include additional information.
export type PylonIntrospectionInactive = {
  active: false;
};

// Discriminated union on `active`. Consumers must check `active` before
// reading claim fields — TS narrows to the correct branch.
export type PylonIntrospection = PylonIntrospectionActive | PylonIntrospectionInactive;
