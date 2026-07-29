import type { Condition } from "@lindorm/match";
import type { TokenType } from "../../constants/token-type.js";
import type { AegisVerifyKey } from "../keys/key-selectors.js";
import type { ActClaim } from "../claims/domain/act-claim.js";

// How `allowedActors` is applied to the token's actor chain:
// - "every"   (default) every actor in the chain must match the predicate.
//             Fail-closed; the only scope that catches an unauthorized
//             intermediary, since aegis does not validate `may_act`.
// - "current" only the immediate actor (actorChain[0]) must match. Trusts
//             the rest of the chain — "is my caller allowed".
// - "some"    at least one actor matches. Attestation ("token passed
//             through gateway G at some point").
export type ActorScope = "every" | "current" | "some";

export type VerifyActorOptions = {
  required?: boolean;
  forbidden?: boolean;
  allowedActors?: Condition<ActClaim>;
  actorScope?: ActorScope;
  maxChainDepth?: number;
};

/**
 * The verify-time KNOBS for `aegis.verify(token, assert, options)` — format
 * agnostic (JOSE + COSE share it). No claim matchers live here anymore: the
 * declarative claim assertions moved to the positional {@link DomainAssert}
 * argument. What stays are the structural/policy knobs plus the three
 * hash-DERIVE inputs (`accessToken`/`authCode`/`authState`) — verify-time
 * at_hash/c_hash/s_hash checks, computed (not name-mapped), so they belong with
 * verify options, not the claim matchers.
 */
export type VerifyOptions = {
  actor?: VerifyActorOptions;
  /**
   * Override "now" for the temporal range checks (R10). When set, `exp`/`nbf`/
   * `iat` are validated against this instant instead of the real wall-clock — a
   * token expired relative to a PAST `currentDate` still verifies. Threaded to the
   * kit's temporal check AND the domain `exp`-presence lower bound. Per-call only.
   */
  currentDate?: Date;
  /**
   * Reject a token whose `iat` is older than this many seconds (R10). Adds an
   * `iat >= now - maxTokenAge` lower bound (with clock tolerance) and requires
   * `iat` to be present. Per-call only.
   */
  maxTokenAge?: number;
  dpopProof?: string;
  /**
   * When true, aegis will not raise an error if the token carries a
   * `cnf.jkt` binding but no `dpopProof` was supplied to this verify call.
   * The caller asserts the DPoP binding is enforced out-of-band (for
   * example, pylon's socket auth establishes the jkt binding at handshake
   * time and trusts it for the remainder of the socket lifetime). Default
   * behaviour (undefined/false) is RFC 9449 strict: a bound token without
   * a proof is rejected.
   */
  trustBoundThumbprint?: boolean;
  tokenType?: TokenType;
  /**
   * Per-call verification key policy — a CHECK on the key the token's `kid`
   * names, applied before the signature is checked, or a `kryptos` supplied
   * outright for a signature made by a key not in the vault (RFC 7523
   * `client_secret_jwt`). Not a claim matcher: `createJwtVerify` skips it, and
   * `JwtKit` (which is handed an explicit key) ignores it entirely.
   */
  key?: AegisVerifyKey;
  /**
   * JOSE `typ` header presence policy at parse time (default `"required"`).
   * `"required"` rejects a typ-less token (`jwt_invalid_typ`) — the RFC 8725
   * explicit-typing defense direct callers rely on. `"optional"` accepts an
   * absent typ; profiled verify sets this, because the profile floor owns the
   * real presence policy (required-presence profiles still reject an absent
   * typ at the floor). Vocabulary matches TokenProfileTyp.
   */
  typPresence?: "required" | "optional";
  /**
   * `exp` claim presence policy (default `"required"`). `"required"` rejects an
   * exp-less token (`jwt_missing_claim_exp`) — the default for direct/profile-less
   * callers. `"optional"` accepts an absent exp; profiled verify sets this for a
   * `lifetime: null` profile (RFC 8417 / SSF `security_event` SETs carry no exp),
   * where the profile floor owns the real presence policy. When exp IS present its
   * value is always range-checked (with clock tolerance) regardless of this option.
   */
  expPresence?: "required" | "optional";
  /**
   * The access token whose SHA left-half must equal the token's `at_hash`
   * (OIDC Core §3.1.3.6). Hashed with the token's signing algorithm at verify
   * time, not compared literally.
   */
  accessToken?: string;
  /**
   * The authorization code whose SHA left-half must equal the token's `c_hash`
   * (OIDC Core §3.3.2.11). Hashed at verify time.
   */
  authCode?: string;
  /**
   * The state whose SHA left-half must equal the token's `s_hash`
   * (OIDC financial-grade). Hashed at verify time.
   */
  authState?: string;
};
