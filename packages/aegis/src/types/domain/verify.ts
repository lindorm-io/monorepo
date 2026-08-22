import type { Condition } from "@lindorm/match";
import type { AegisVerifyKey } from "../keys/key-selectors.js";
import type { ActClaim } from "../claims/domain/act-claim.js";

export type VerifyActorOptions = {
  required?: boolean;
  forbidden?: boolean;
  /**
   * Matched against the CURRENT actor alone — `actorChain[0]`. Prior actors are
   * not read. RFC 8693 §4.1.
   *
   * A token naming no actor cannot satisfy it and is refused — including under a
   * condition stated as a denial, which the matcher's two-valued `$not` would
   * otherwise let an absent actor satisfy.
   *
   * A condition that constrains nothing places no constraint this verifier can
   * apply, so the CALL is refused (`actor_policy_invalid`) rather than the
   * condition applied. That covers `{}`, a condition whose every key is
   * `undefined`, and the logical forms reducing to them: an `$and` whose every
   * member constrains nothing, an `$or` with any such member, a `$not` of a
   * condition no actor satisfies. A logical operator's member is read for its own
   * defined keys, so one carrying none — `[]`, `5`, `new Date()` — constrains
   * nothing exactly as `{}` does.
   */
  allowedActor?: Condition<ActClaim>;
  maxChainDepth?: number;
};

/**
 * The verify-time KNOBS for `aegis.verify(token, assert, options)` — format
 * agnostic (JOSE + COSE share it).
 *
 * A MATCHER asserts what must be true; an OPTION changes how the check runs.
 * Everything here is the latter: key policy, presence policy, the temporal
 * window, DPoP and actor-chain enforcement. Every ASSERTION — including
 * `tokenType` and the three hash-derive inputs, which verify always read out of
 * the matcher bag internally — lives on the positional
 * {@link import("./domain-assert.js").VerifyAssert} argument.
 */
export type VerifyOptions = {
  actor?: VerifyActorOptions;
  /**
   * Widen the temporal range checks by this many seconds in BOTH directions, to
   * absorb clock skew between the issuer and this verifier: a `"past"` claim
   * (`iat`/`nbf`/`auth_time`) may sit this far in the future, a `"future"` claim
   * (`exp`) this far in the past. Overrides the deployment-wide
   * `AegisSettings.clockTolerance` (default `0`) for this call only.
   */
  clockTolerance?: number;
  /**
   * Override "now" for the temporal range checks. When set, `exp`/`nbf`/
   * `iat` are validated against this instant instead of the real wall-clock — a
   * token expired relative to a PAST `currentDate` still verifies. Threaded to the
   * kit's temporal check AND the domain `exp`-presence lower bound. Per-call only.
   */
  currentDate?: Date;
  /**
   * Custom header parameters the CALLER takes responsibility for — it will act on
   * them after aegis returns: aegis is never the final recipient, it verifies on
   * the application's behalf. RFC 7515 §4.1.11.
   *
   * A `crit` member is accepted only when it is named here AND carried by the
   * token. Absent means nothing is declared, so EVERY critical parameter is
   * refused — `objectId` included, since registering a parameter says nothing
   * about whether the application can act on it. Fail closed.
   *
   * ⚠ DOMAIN names, like every other domain surface — `["objectId"]`, never
   * `["oid"]`, which is refused. An unregistered custom parameter is spelled
   * identically at both tiers.
   */
  critical?: Array<string>;
  /**
   * Reject a token whose `iat` is older than this many seconds. Adds an
   * `iat >= now - maxTokenAge` lower bound (with clock tolerance) and requires
   * `iat` to be present. Per-call only. Independent of {@link verifyIssuedAt}:
   * an explicit `maxTokenAge` still applies its own bound + presence even when
   * `verifyIssuedAt` is `false`.
   */
  maxTokenAge?: number;
  /**
   * Range-check `exp`. Default `true`. `false` ⇒ an EXPIRED token still
   * verifies (its `exp` value is not bounded). Presence is independent — with
   * `expPresence: "required"` an exp-LESS token is still rejected, only the
   * VALUE is not range-checked. Signature/`iss`/`aud`/`nonce`/hashes stay
   * enforced. The option exists for OIDC `id_token_hint`. OIDC Core §3.1.2.1,
   * OIDC Core §3.1.2.2.
   */
  verifyExpiration?: boolean;
  /**
   * Range-check `nbf`. Default `true`. `false` ⇒ a not-yet-valid token still
   * verifies (its `nbf` value is not bounded).
   */
  verifyNotBefore?: boolean;
  /**
   * Range-check `iat`. Default `true`. `false` ⇒ the `iat` upper bound is not
   * applied. An explicit {@link maxTokenAge} still enforces its own iat bound.
   */
  verifyIssuedAt?: boolean;
  /**
   * Range-check `auth_time`. Default `true`. `false` ⇒ `auth_time` is not
   * bounded. `auth_time` is a "past" claim so it never blocks a historical
   * token; the flag exists for symmetry with the other temporal claims.
   */
  verifyAuthTime?: boolean;
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
   * `"required"` rejects a typ-less token (`typ_required` — distinct from the
   * kits' `jwt_invalid_typ`, which means a typ that is PRESENT and wrong) — the
   * explicit-typing defense direct callers rely on (RFC 8725 §3.11). `"optional"` accepts an
   * absent typ; profiled verify sets this, because the profile floor owns the
   * real presence policy (required-presence profiles still reject an absent
   * typ at the floor). Vocabulary matches TokenProfileTyp.
   */
  typPresence?: "required" | "optional";
  /**
   * `exp` claim presence policy (default `"required"`). `"required"` rejects an
   * exp-less token (`missing_claim_exp`) — the default for direct/profile-less
   * callers. `"optional"` accepts an absent exp; profiled verify sets this for a
   * `lifetime: null` profile (the `security_event` profile — RFC 8417), where the
   * profile floor owns the real presence policy. When exp IS present its
   * value is always range-checked (with clock tolerance) regardless of this option.
   */
  expPresence?: "required" | "optional";
};
