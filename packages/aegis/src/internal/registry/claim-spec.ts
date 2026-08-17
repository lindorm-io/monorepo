/**
 * The CLAIM half of the shared {@link ParamSpec} base — the payload-side twin of
 * {@link HeaderSpec}. THREE fields beyond the base — `temporal`, `bucket` and
 * `domainClaim` — and each is meaningless for a header parameter, which is why
 * they live here and not on the base.
 *
 * ⚠ `whenEmpty` USED to be a fourth, and it was the one that did not belong: a
 * header parameter has an empty form too, and stating the column on one sibling
 * left the other emitting an empty value with no decision recorded. It now lives
 * on {@link ParamSpec} and both registries answer it.
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
 *   - `"confirmation"` RFC 7800 `cnf` (proof-of-possession key).
 *   - `"act"`          RFC 8693 delegation `act`/`may_act` (recursive actor).
 *   - `"subId"`        RFC 9493 `sub_id` subject identifier.
 *   - `"events"`       RFC 8417 SET `events` map (carried verbatim).
 *   - `"authDetails"`  RFC 9396 `authorization_details` array (carried verbatim).
 *   - `"address"`      OIDC §5.1 `address` (nested object; snake its inner keys).
 *
 * ⚠ There WAS a seventh, `"hash"`, for the OIDC hashes — and it was not a
 * builder at all. Both translator arms were byte-for-byte the `"text"` arm
 * (`return value` on encode, `isString(value) ? value : undefined` on decode);
 * the sub-kind existed to key ONE COSE byte shape. That is a CODEC fact, not a
 * structure fact, and the registry already had the mechanism for it — the
 * per-wire codec `tokenId` uses. The hashes are `kind: "text"` with a
 * `per: { cose: { kind: "bstr", encoding: "b64u" } }` override now, and a
 * "bespoke" kind that is a codec gap rather than a structure gap has nowhere
 * left to hide.
 */
export type BespokeKind =
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
 *   - `"bstr"`    byte string — a PER-WIRE codec only; no claim carries it as its
 *                 base codec, because JOSE has no byte strings. See the
 *                 `encoding` note below for how the domain string becomes bytes
 *   - `"array"`   array of strings, with its scalar-tolerance policy
 *   - `"bespoke"` needs a per-claim builder, named by its sub-kind
 */
export type ClaimCodec =
  | { kind: "text" }
  | { kind: "int" }
  | { kind: "date" }
  | { kind: "bool" }
  /**
   * Byte string. `encoding` says how the DOMAIN string maps to those bytes:
   *   - `"utf8"` the string's OWN bytes (`tokenId` -> `cti`, RFC 8392 §3.1.7).
   *   - `"b64u"` the string IS base64url and the bytes are what it decodes to
   *              (the OIDC hashes — a 43-char `at_hash` is 32 bytes on COSE).
   *
   * ⚠ REQUIRED, with no default. The two alphabets are indistinguishable at the
   * type level and silently produce DIFFERENT bytes on a signed wire, so there
   * is nothing safe to fall into. It is a SELECTOR, not a value forwarded to
   * `@lindorm/cbor`: `CborField.encoding` has no `"utf8"` member, and `"utf8"`
   * resolves to a bespoke encode/decode pair instead (`internal/cose/cwt-spec.ts`).
   */
  | { kind: "bstr"; encoding: "utf8" | "b64u" }
  | { kind: "array"; scalar: ArrayScalar }
  | { kind: "bespoke"; bespoke: BespokeKind };

/**
 * ⚠ NARROWED to `"keep" | "prune"`: `refuse` is a HEADER verdict, and the third
 * type parameter is what says so — a runtime loop over the column could only
 * restate what the compiler already refuses, so there is none.
 *
 * The reason is not structural, and it is NOT that the claims side already
 * refuses every unhonourable empty value — that was this comment's claim and it
 * was false in exactly the cells where it mattered. The profile floor is a
 * PROFILE's floor: it refuses an empty value only for the claims some profile
 * names in a `required`/`forbidden`/shape rule, and the eleven `whenEmpty:
 * "keep"` cells are the ones whose empty form survives the prune to reach the
 * wire in the first place. `aud: []` satisfied `required: ["audience"]` in all
 * TEN built-in profiles that name `audience` in a presence rule under the old
 * single predicate — nine of them with nothing else catching it — and a claim no
 * profile mentions is not refused anywhere at all, then or now.
 *
 * The real reason is that `refuse` is a verdict about the EMISSION BOUNDARY, and
 * the two sides do not have the same boundary to speak from. A header parameter
 * is written by aegis itself at the moment of assembly, so the boundary is the
 * only place that sees it and a throw there is the earliest possible repair
 * point. A claim arrives from a caller who was ALREADY answered a layer up, in
 * its own vocabulary and with the claim's DOMAIN name in the error — so the
 * emission prune is the later and blinder of the two places to speak, not the
 * only one. Which claims that layer speaks about is a PROFILE decision, and it
 * belongs there: see the `whenEmpty` note in `claims-registry.ts`.
 */
export type ClaimSpec<D = unknown> = ParamSpec<D, ClaimCodec, "keep" | "prune"> & {
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
