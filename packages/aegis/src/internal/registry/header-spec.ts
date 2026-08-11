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
 * ⚠ Not yet ENFORCED anywhere — see {@link HeaderSpec.placement}.
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
   * ⚠ ASPIRATIONAL on 19 of the 21 entries: NOTHING enforces it today.
   * `build-cose-headers.ts` refuses only crit-in-unprotected, crit-listed
   * parameters, the kit's reserved labels and a param set in both bags — it never
   * consults `placement`. So a caller may put `typ`, `cty`, `x5c`, `x5u` or `oid`
   * in the unprotected bag right now, which is what the `unprotected-typ`
   * scenarios pin as red. The two `"either"` rows (`kid`, `iv`) DO describe what
   * the COSE kits emit; the 19 `"protected"` rows describe where the parameter
   * BELONGS, not where the code keeps it. Marked inline rather than silently
   * corrected, the same convention `kit-capabilities.ts` uses for its
   * not-yet-enforced rows.
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
