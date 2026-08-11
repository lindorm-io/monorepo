/**
 * The CLAIM half of the shared {@link ParamSpec} base — the payload-side twin of
 * {@link HeaderSpec}. Two fields beyond the base, and both are meaningless for a
 * header parameter, which is why they live here and not on the base.
 */

import type { ParamSpec } from "./param-spec.js";

/**
 * How an array claim tolerates a SCALAR on read. Required on every `array`
 * codec — the three cases are exhaustive and none of them is a default:
 *   - `"spaced"` a space-delimited STRING is accepted and SPLIT into the array
 *                (`"a b"` -> `["a","b"]`): `scope`/`roles`/`permissions`/
 *                `conformsTo` (RFC 6749 §3.3 spelling).
 *   - `"strict"` arrays ONLY; a scalar decodes to `undefined`: `amr`/`afc`/
 *                `entitlements`/`groups`/`preferredAccessibility`.
 *   - `"wrap"`   a scalar WRAPS to a single-element array: `aud` alone, because
 *                RFC 7519 §4.1.3 defines it as string-OR-array.
 */
export type ArrayScalar = "spaced" | "strict" | "wrap";

/**
 * Sub-kind of a `bespoke` claim — the discriminator that tells the translator
 * (encode/decode) and the COSE byte-shaper WHICH per-claim builder to use.
 * Claims sharing a builder share a sub-kind:
 *   - `"hash"`         the OIDC hashes (`at_hash`/`c_hash`/`s_hash`): a b64url
 *                      string on JOSE, a COSE byte string.
 *   - `"confirmation"` RFC 7800 `cnf` (proof-of-possession key).
 *   - `"act"`          RFC 8693 delegation `act`/`may_act` (recursive actor).
 *   - `"subId"`        RFC 9493 `sub_id` subject identifier.
 *   - `"events"`       RFC 8417 SET `events` map (carried verbatim).
 *   - `"authDetails"`  RFC 9396 `authorization_details` array (carried verbatim).
 *   - `"address"`      OIDC §5.1 `address` (nested object; snake its inner keys).
 */
export type BespokeKind =
  | "hash"
  | "confirmation"
  | "act"
  | "subId"
  | "events"
  | "authDetails"
  | "address";

/**
 * How a claim's VALUE is shaped. A CLOSED union, kept separate from the header
 * codec union so both translators keep an exhaustive `switch` with a `never`
 * default.
 *   - `"text"`    string scalar (iss, sub, acr…)
 *   - `"int"`     plain number, no transform (loa…)
 *   - `"date"`    NumericDate: domain `Date` <-> wire Unix-seconds int
 *   - `"bool"`    boolean scalar
 *   - `"bstr"`    byte string — a PER-WIRE codec only (COSE `cti`); no claim
 *                 carries it as its base codec, because JOSE has no byte strings
 *   - `"array"`   array of strings, with its scalar-tolerance policy
 *   - `"bespoke"` needs a per-claim builder, named by its sub-kind
 */
export type ClaimCodec =
  | { kind: "text" }
  | { kind: "int" }
  | { kind: "date" }
  | { kind: "bool" }
  | { kind: "bstr" }
  | { kind: "array"; scalar: ArrayScalar }
  | { kind: "bespoke"; bespoke: BespokeKind };

export type ClaimSpec<D = unknown> = ParamSpec<D, ClaimCodec> & {
  /**
   * VALIDATION-temporal direction — set ONLY on the time claims the verifier
   * range-checks against "now", the single source of truth for the temporal
   * matcher set. NOT every `date` claim: `updatedAt` is a date but a profile
   * timestamp, not validation-temporal, so it carries no mark.
   *   - `"past"`    must not be in the future (value <= now + tolerance):
   *                 `nbf`/`iat`/`auth_time`.
   *   - `"future"`  must not be in the past (value >= now - tolerance): `exp`.
   */
  temporal?: "past" | "future";
  /**
   * Which read-side bucket the claim lands in:
   *   - `"claims"`  the standard/protocol claim set (RFC / OIDC top-level).
   *   - `"profile"` the OIDC Core §5.1 profile set (`AegisProfile`).
   * A claim NOT in the registry buckets to `custom` — so `custom` is the ABSENCE
   * of an entry, never a bucket value. SENSITIVITY is a SEPARATE column
   * ({@link ParamSpec.sensitivity}): the sensitive identity claims are
   * `bucket: "claims"` AND `sensitivity: "sensitive"`, so the two facts compose
   * instead of a three-way category forcing a choice between them.
   */
  bucket: "claims" | "profile";
  /**
   * The claim is part of `DomainClaims`, so the verify-FLOOR read resolves it to
   * its domain name. Absent ⇒ it is not (SET-only `events`/`txn`, profile,
   * sensitive), and the floor leaves it in `custom` under its wire spelling.
   *
   * ⚠ NOT part of the shared {@link ParamSpec} base: it is a CLAIM-only fact,
   * and it is what the verify-floor read scopes itself by. It survived the codec
   * unification because that read genuinely resolves a narrower set than the
   * domain read does — see `ClaimReadMode` — and collapsing the two is a policy
   * decision belonging to the verify rewrite, not a codec change.
   *
   * ⚠ A single mark, deliberately: it once grouped its members three ways
   * (`core`/`rfc8693`/`pop`) for a hand-written extractor that needed three key
   * tables, and that extractor is gone. The mark and the `DomainClaims` type
   * describe the same set from two sides; `claims-registry.test.ts` binds them to
   * each other in both directions, so they cannot drift apart silently.
   */
  domainClaim?: true;
};
