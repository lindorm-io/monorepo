import type { Dict } from "@lindorm/types";
import type { CertificateBindingMode } from "../header/domain-header.js";
import type { CoseHeaderBuckets, JoseHeaderBuckets } from "../header/wire-buckets.js";
import type {
  CoseWireTokenEnvelope,
  JoseWireTokenEnvelope,
} from "../header/wire-envelope.js";

/**
 * The JWT STRUCTURED (claims-bearing) sign options — exactly the JOSE wire
 * envelope: the claims dict is the positional argument (`JwtClaimsWire & C`), and
 * these options are pure wire knobs.
 *
 * ⚠ There is deliberately NO prune knob, on either wire. Whether an empty claim
 * reaches the wire is a fact about the CLAIM, answered once by the claim
 * registry's `whenEmpty` cell and applied on every emission
 * (`internal/utils/normalise-claims.ts`) — a per-call mode made a per-claim
 * question look like a caller's preference.
 */
export type JoseSignStructuredTokenOptions = JoseWireTokenEnvelope;

/**
 * The CWT/CWM STRUCTURED (claims-bearing) sign options — exactly the COSE wire
 * envelope; the claims dict (`CwtClaimsWire & C`) is the positional argument. Same
 * no-prune-knob rule as {@link JoseSignStructuredTokenOptions}.
 */
export type CoseSignStructuredTokenOptions = CoseWireTokenEnvelope;

/**
 * The STRUCTURED verify options — shared by JWT, CWT, CWM. Pure wire structural
 * knobs; no named domain matchers, no presence policy (those live Aegis-side).
 * `certBindingMode` governs the post-verify certificate check on BOTH wires
 * (RFC 9360 §2 for the COSE parameters); `tokenType` is the bare PREFIX the
 * kit re-wraps into the expected media type.
 */
export type VerifyStructuredTokenOptions = {
  certBindingMode?: CertificateBindingMode;
  clockTolerance?: number;
  /**
   * Custom header parameters the CALLER takes responsibility for — it will act on
   * them after aegis returns: aegis is never the final recipient, it verifies on
   * the application's behalf. RFC 7515 §4.1.11.
   *
   * A `crit` member is accepted only when it is named here AND carried by the
   * token. Absent means nothing is declared, so EVERY critical parameter is
   * refused — `oid` included, since registering a parameter says nothing about
   * whether the application can act on it. Fail closed.
   *
   * ⚠ WIRE names — `["oid"]`, never the domain `["objectId"]`. An unregistered
   * custom parameter is spelled identically at both tiers.
   */
  crit?: Array<string>;
  /**
   * Override "now" for the temporal range checks. When set, `exp`/`nbf`/
   * `iat` are validated against this instant instead of the real wall-clock.
   * Per-call only.
   */
  currentDate?: Date;
  /**
   * Reject a token whose `iat` is older than this many seconds. Adds an
   * `iat >= now - maxTokenAge` lower bound (with clock tolerance) and requires
   * `iat` to be present. Per-call only. Independent of {@link verifyIssuedAt}.
   */
  maxTokenAge?: number;
  /**
   * Range-check `exp`. Default `true`. `false` ⇒ the `exp` range bound is
   * skipped, so an EXPIRED token verifies. Presence is a domain concern and is
   * not affected here.
   */
  verifyExpiration?: boolean;
  /** Range-check `nbf`. Default `true`. `false` ⇒ the `nbf` bound is skipped. */
  verifyNotBefore?: boolean;
  /** Range-check `iat`. Default `true`. `false` ⇒ the `iat` upper bound is skipped. */
  verifyIssuedAt?: boolean;
  /** Range-check `auth_time`. Default `true`. `false` ⇒ the `auth_time` bound is skipped. */
  verifyAuthTime?: boolean;
  /**
   * Assert the header `typ` equals the media type the kit builds from this bare
   * PREFIX (`"at"` → `application/at+jwt` / `application/at+cwt`). Aegis derives
   * the prefix from the domain `tokenType`.
   */
  tokenType?: string;
};

/**
 * The NATIVE WIRE result of verifying a STRUCTURED token (`JwtKit.verify`).
 * Carries the WIRE-keyed `payload` (`sub`/`exp`/`jti`, never the domain
 * `subject`/`expiresAt`/`tokenId`), the JOSE header buckets
 * ({@link JoseHeaderBuckets}), and the compact token. The domain claim + header
 * translation is Aegis-side (`aegis.verify` → `VerifiedToken`).
 *
 * The wire is IN THE NAME rather than in a `TokenData` generic: a JOSE token is a
 * `string`, and a generic spanning both wires lets a caller write the JOSE result
 * of a `Buffer` token — the impossible state {@link CoseVerifiedStructuredToken}
 * exists to keep unwritable.
 */
export type JoseVerifiedStructuredToken<C extends Dict = Dict> = JoseHeaderBuckets & {
  payload: C;
  token: string;
};

/**
 * The NATIVE WIRE result of verifying a STRUCTURED token on COSE (`CwtKit`/
 * `CwmKit` verify) — the {@link JoseVerifiedStructuredToken} twin, over the two
 * COSE buckets ({@link CoseHeaderBuckets}) and the `Buffer` token COSE carries.
 */
export type CoseVerifiedStructuredToken<C extends Dict = Dict> = CoseHeaderBuckets & {
  payload: C;
  token: Buffer;
};

/**
 * The `decode` result for a STRUCTURED JOSE token: the JOSE header buckets +
 * cleartext WIRE claims, NO signature verification.
 */
export type JoseDecodedStructuredToken<C extends Dict = Dict> = JoseHeaderBuckets & {
  payload: C;
  signature: string;
  token: string;
};

/**
 * The `decode` result for a STRUCTURED COSE token — CWT ≡ CWM: the two COSE
 * header buckets + cleartext WIRE claims, NO signature/MAC verification.
 */
export type CoseDecodedStructuredToken<C extends Dict = Dict> = CoseHeaderBuckets & {
  payload: C;
  signature: Buffer;
  token: Buffer;
};
