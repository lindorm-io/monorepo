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
   * MAY THIS PARAMETER BE NAMED IN `crit` — i.e. is it a critical extension
   * AEGIS IMPLEMENTS? ONE cell, read from BOTH directions through ONE predicate
   * (`internal/header/is-crit-eligible.ts`), which is what makes it a gate
   * rather than a note:
   *
   *   - MINT   `internal/header/assert-crit-eligible.ts`, at both wire builders,
   *            refuses a caller's `crit` naming a parameter whose cell is
   *            `false` — or a name the registry does not know at all.
   *   - VERIFY `internal/utils/reject-unknown-critical.ts` accepts a member
   *            whose cell is `true` and refuses every other.
   *
   * One column both ways is the whole point: a token aegis mints is a token
   * aegis verifies.
   *
   * ⚠ THE TWO DIRECTIONS ARE NOT SYMMETRIC IN WHAT THEY CAN OBSERVE, and saying
   * they are would overstate what the read side proves. On MINT all three
   * outcomes are visible — `true`, `false`, and no entry — because the gate is
   * the first thing a caller's `crit` meets. On VERIFY only `true` versus "no
   * registry entry at all" is: `rejectUnknownCritical` runs `validateCrit`
   * first, which refuses every IANA-registered name, and `oid` is the ONLY
   * registered parameter that is both crit-eligible and absent from that list —
   * so the `false` branch has no reachable input on the read path today and a
   * loop asking merely "is this parameter registered" would behave identically.
   *
   * That is a fact about today's registry, not a property of the design, and it
   * is pinned in `reject-unknown-critical.test.ts` in both directions: one test
   * binds the two sources (an eligible parameter must survive `validateCrit`, or
   * aegis would mint a token it refuses on arrival), and one asserts the
   * unreachability itself — so the day a second non-IANA parameter is registered
   * ineligible, or the IANA list is trimmed, the tripwire fires and the read
   * side owes a probe it cannot be given now.
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
