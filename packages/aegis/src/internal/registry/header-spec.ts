/**
 * The HEADER half of the shared {@link ParamSpec} base — the twin of
 * {@link ClaimSpec}. Two fields beyond the base, and both are meaningless for a
 * claim, which is why they live here and not on the base.
 */

import type { CoseHeaderCodec } from "./cose-header-codec.js";
import type { ParamSpec, WhenEmpty } from "./param-spec.js";

/**
 * How a header parameter's VALUE is shaped, and (on the WRITE side) the
 * defensive guard the encoder applies before putting it on the wire. Most
 * parameters are a plain string passthrough; `critical` is the one
 * member-transforming case.
 *
 * A CLOSED union, kept separate from {@link ClaimCodec} so both translators keep
 * an exhaustive `switch` with a `never` default.
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
 * Which header BUCKET a parameter may occupy. A wire with no unprotected bucket
 * (JOSE compact serialisation) puts everything in the protected one, so this is
 * a statement about where the parameter is ALLOWED, not where it always lands —
 * whether a given kit HAS an unprotected bucket is a kit capability, not a
 * parameter fact.
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
   * HOW THE VALUE IS SHAPED ON THE COSE WIRE — the per-wire other half of
   * `codec`, which describes JOSE. `null` exactly where `wire.cose` is `absent`:
   * a parameter COSE does not carry has no COSE representation to describe, and
   * a cell nothing can read is the defect this registry keeps out. The two are
   * bound to each other in `header-registry.test.ts`, so neither can drift.
   *
   * Both COSE passes switch over it exhaustively, so neither carries a
   * parameter-name list of its own — see {@link CoseHeaderCodec}.
   */
  cose: CoseHeaderCodec | null;
  /**
   * Which bucket the parameter may occupy — see {@link HeaderPlacement}.
   *
   * READ  — `merge-header-buckets.ts` IGNORES a `"protected"` parameter arriving
   * in a FOREIGN token's unprotected bucket, so it cannot reach the domain header
   * at all. That is the one predicate reading this column
   * (`internal/header/is-protected-only.ts`).
   *
   * ⚠ THE WRITE SIDE NEEDS NO SUCH RULE: `header` is the only registered bag a
   * caller can fill and it travels protected, so the shape the column would
   * refuse is unwritable (`build-cose-headers.ts`).
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
   * MAY THIS PARAMETER BE NAMED IN `crit` — i.e. is it a critical extension
   * AEGIS IMPLEMENTS? Read through ONE predicate,
   * `internal/header/is-crit-eligible.ts`, which serves the MINT gate
   * `internal/header/assert-crit-eligible.ts` at both wire builders.
   *
   * ⛔ MINT IS THE ONLY GATE THAT READS IT. The read gate never admits a member
   * on the strength of a registry cell — `oid` included: RFC 7515 §4.1.11 puts
   * the duty to understand a critical extension on the RECIPIENT, and that aegis
   * REGISTERS a parameter says nothing about whether the application behind aegis
   * can act on one. ⇒ This cell decides what a PRODUCER may name; what a RECIPIENT
   * accepts is the read rule, stated once on
   * `internal/utils/reject-unknown-critical.ts` — the verify/decrypt `crit`
   * option is necessary there and never sufficient on its own.
   *
   * ⚠ The write gate does not read the cell directly either — it goes through
   * `internal/header/is-crit-eligible.ts`, admitting a member when this cell is
   * `true` OR when the same call writes the name as an UNREGISTERED custom
   * parameter. That second ground is the same RFC 7515 §4.1.11 sentence read the
   * other way, so this column is the REGISTRY HALF of the write rule and never
   * the whole of it.
   *
   * ⚠ STILL BOUND TO THE READ IN ONE DIRECTION, and it has to be: an eligible
   * parameter must SURVIVE `validateCrit`, which refuses every
   * specification-defined name — otherwise aegis mints a token it refuses on
   * arrival for a reason no declaration could repair. Pinned in
   * `reject-unknown-critical.test.ts#every crit-eligible parameter survives the
   * read path's malformed gate`.
   *
   * `false` on every entry but `oid`. RFC 7515 §4.1.11 forbids a producer naming
   * a parameter *"defined by this specification or [JWA] for use with JWS"* in
   * `crit`, and `oid` is the only parameter aegis owns that neither document
   * defines — the other twenty JOSE names are IANA-registered JOSE header
   * parameters. The eligible cell itself states what aegis IMPLEMENTING an
   * extension means; see the `oid` entry.
   *
   * ⛔ NAMED FOR THE QUESTION, not for the thing — do not rename it `critical`.
   * That word already means three other things here: the `crit` PARAMETER's
   * domain name (`header-registry.ts`), the public `DomainTokenHeader.critical`
   * field, and the `{ kind: "critical" }` CODEC. Spelled this way the `crit`
   * entry's own row reads as a true sentence rather than a contradiction — the
   * `crit` parameter may not itself be named in `crit`.
   */
  critEligible: boolean;
};
