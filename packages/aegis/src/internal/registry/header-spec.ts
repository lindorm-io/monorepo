/**
 * The HEADER half of the shared {@link ParamSpec} base — the twin of
 * {@link ClaimSpec}. Two fields beyond the base, and both are meaningless for a
 * claim, which is why they live here and not on the base.
 */

import type { ParamSpec } from "./param-spec.js";

/**
 * How a header parameter's VALUE is shaped, and (on the WRITE side) the
 * defensive guard the encoder applies before putting it on the wire. Most
 * parameters are a plain string passthrough; `critical` is the one
 * member-transforming case.
 *
 * A CLOSED union, kept separate from {@link ClaimCodec} so both translators keep
 * an exhaustive `switch` with a `never` default.
 *   - `"string"`   scalar string, guarded `isString` (alg, kid, typ, cty, enc,
 *                  oid, x5t#S256, x5t, x5u, zip, apu, apv)
 *   - `"url"`      URL-like string, guarded `isUrlLike` (jku)
 *   - `"number"`   finite number, guarded `isFinite` (p2c)
 *   - `"jwk"`      JWK object, guarded `isObject` (jwk, epk)
 *   - `"buffer"`   Buffer passthrough on the raw side, base64url-encoded
 *                  downstream in `encodeJoseHeader` (iv, p2s, tag)
 *   - `"array"`    Array<string> passthrough, guarded `Array.isArray` (x5c)
 *   - `"critical"` the `crit` array whose MEMBERS are themselves domain<->wire
 *                  remapped (crit)
 */
export type HeaderCodec =
  | { kind: "string" }
  | { kind: "url" }
  | { kind: "number" }
  | { kind: "jwk" }
  | { kind: "buffer" }
  | { kind: "array" }
  | { kind: "critical" };

/**
 * Which header BUCKET a parameter may occupy. A wire with no unprotected bucket
 * (JOSE compact serialisation) puts everything in the protected one, so this is
 * a statement about where the parameter is ALLOWED, not where it always lands —
 * whether a given kit HAS an unprotected bucket is a kit capability, not a
 * parameter fact.
 *
 *   - `"protected"`   integrity-protected only.
 *   - `"unprotected"` unauthenticated bucket only.
 *   - `"either"`      may appear in either — today `kid` (a COSE routing hint
 *                     that travels unprotected) and `iv`.
 */
export type HeaderPlacement = "protected" | "unprotected" | "either";

export type HeaderSpec<D = unknown> = ParamSpec<D, HeaderCodec> & {
  /**
   * Which bucket the parameter may occupy — see {@link HeaderPlacement}.
   *
   * ENFORCED IN BOTH DIRECTIONS, through the one predicate that reads this column
   * (`internal/header/is-protected-only.ts`):
   *
   *   - WRITE — `build-cose-headers.ts` REFUSES a `"protected"` parameter placed
   *     in a caller's unprotected bag (`cose_unprotected_placement`).
   *   - READ  — `merge-header-buckets.ts` IGNORES one arriving in a token's
   *     unprotected bucket, so it cannot reach the domain header at all.
   *
   * That is what lets the domain tier report ONE header without losing the
   * provenance guarantee: the only values that can enter it unauthenticated are
   * the two `"either"` rows, `kid` and `iv` — the COSE routing hint and the AEAD
   * nonce, which RFC 9052 §3.1 puts outside the protected bucket precisely
   * because they are not security-critical.
   *
   * ⚠ It states where a parameter is ALLOWED, never where it lands: a JOSE kit
   * has no unprotected bucket at all, so `"either"` and `"protected"` are the
   * same instruction there.
   */
  placement: HeaderPlacement;
  /**
   * Whether aegis treats this parameter as a CRITICAL extension a recipient must
   * understand (RFC 7515 §4.1.11 / RFC 9052 §3.1) — i.e. whether it belongs in
   * `crit`. Every entry is `false` today: aegis implements no crit extension, so
   * any parameter a producer marks critical is by definition one aegis does not
   * understand. The column exists so the first extension parameter has to say so
   * here rather than in a kit branch.
   */
  critical: boolean;
};
