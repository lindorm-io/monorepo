/**
 * The HEADER half of the shared {@link ParamSpec} base — the twin of
 * {@link ClaimSpec}. Its extra fields are meaningless for a claim, which is why
 * they live here and not on the base.
 */

import type { CoseHeaderCodec } from "./cose-header-codec.js";
import type { ParamSpec, WhenEmpty } from "./param-spec.js";

/**
 * How a header parameter's VALUE is shaped, and (on the WRITE side) the defensive
 * guard the encoder applies before putting it on the wire.
 *
 * A CLOSED union, kept separate from {@link ClaimCodec} so both translators keep an
 * exhaustive `switch` with a `never` default.
 *   - `"string"`   scalar string, guarded `isString`
 *   - `"url"`      URL-like string, guarded `isUrlLike`
 *   - `"number"`   finite number, guarded `isFinite`
 *   - `"jwk"`      JWK object, guarded `isObject`
 *   - `"buffer"`   Buffer passthrough on the raw side, base64url-encoded
 *                  downstream in `encodeJoseHeader`
 *   - `"array"`    Array<string> passthrough, guarded `Array.isArray`
 *   - `"critical"` the `crit` array whose MEMBERS are themselves domain<->wire
 *                  remapped
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
 * Which header BUCKET a parameter may occupy — where it is ALLOWED, not where it
 * lands.
 *
 *   - `"protected"`   integrity-protected only.
 *   - `"unprotected"` unauthenticated bucket only.
 *   - `"either"`      may appear in either — see {@link HeaderSpec.placement}.
 */
export type HeaderPlacement = "protected" | "unprotected" | "either";

/**
 * ⚠ The whole {@link WhenEmpty} vocabulary, unnarrowed: the header side is the
 * one that owns `refuse`. A header parameter can state a guarantee the RECIPIENT
 * enforces (`x5t#S256`), and an empty one of those has no safe disposal — see
 * `internal/header/refuse-empty-headers.ts`.
 */
export type HeaderSpec<D = unknown> = ParamSpec<D, HeaderCodec, WhenEmpty> & {
  /**
   * HOW THE VALUE IS SHAPED ON THE COSE WIRE — the per-wire other half of `codec`,
   * which describes JOSE. `null` exactly where `wire.cose` is `absent`, and the two
   * cells are bound to each other in `header-registry.test.ts`.
   */
  cose: CoseHeaderCodec | null;
  /**
   * Which bucket the parameter may occupy — see {@link HeaderPlacement}.
   *
   * READ — `merge-header-buckets.ts` IGNORES a `"protected"` parameter arriving in a
   * FOREIGN token's unprotected bucket, through the one predicate that reads this
   * column (`internal/header/is-protected-only.ts`). That is what lets the domain
   * tier report ONE header without losing the provenance guarantee; only the
   * `"either"` rows can enter it unauthenticated (RFC 9052 §3.1).
   *
   * ⚠ THE WRITE SIDE NEEDS NO SUCH RULE: `header` is the only registered bag a
   * caller can fill and it travels protected, so the shape the column would refuse
   * is unwritable (`build-cose-headers.ts`).
   */
  placement: HeaderPlacement;
  /**
   * MAY THIS PARAMETER BE NAMED IN `crit`? Read through ONE predicate,
   * `internal/header/is-crit-eligible.ts`, which serves the MINT gate
   * `internal/header/assert-crit-eligible.ts` at both wire builders (RFC 7515
   * §4.1.11).
   *
   * ⛔ MINT IS THE ONLY GATE THAT READS IT. The read gate never admits a member on
   * the strength of a registry cell — `oid` included — because that aegis REGISTERS
   * a parameter says nothing about whether the application behind aegis can act on
   * one. What a RECIPIENT accepts is stated once on
   * `internal/utils/reject-unknown-critical.ts`.
   *
   * ⚠ The write gate does not read the cell directly either: `is-crit-eligible.ts`
   * admits a member when this cell is `true` OR when the same call writes the name
   * as an UNREGISTERED custom parameter. This column is the REGISTRY HALF of the
   * write rule, never the whole of it.
   *
   * ⚠ STILL BOUND TO THE READ IN ONE DIRECTION: an eligible parameter must SURVIVE
   * `validateCrit`, or aegis mints a token it refuses on arrival for a reason no
   * declaration could repair. Pinned in `reject-unknown-critical.test.ts`.
   *
   * ⛔ NAMED FOR THE QUESTION, not for the thing — do not rename it `critical`. That
   * word already means the `crit` PARAMETER's domain name, the public
   * `DomainTokenHeader.critical` field, and the `{ kind: "critical" }` CODEC.
   */
  critEligible: boolean;
};
