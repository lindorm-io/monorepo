/**
 * The CLAIM half of the shared {@link ParamSpec} base — the payload-side twin of
 * {@link HeaderSpec}. Its extra fields are meaningless for a header parameter,
 * which is why they live here rather than on the base.
 */

import type { MemberSpec, ParamSpec, WhenEmpty } from "./param-spec.js";

/**
 * The ONLY input to the aegis confidentiality gate: a `"sensitive"` claim may be
 * published only on an encrypted token. ⚠ A fact about the CLAIM — a caller cannot
 * declassify it by routing the value through another container.
 */
export type Sensitivity = "public" | "sensitive";

/**
 * The wire policy of an `array` codec. Required on every `array` codec; the
 * three cases are exhaustive and none of them is a default.
 *   - `"spaced"` the WIRE FORM is one space-delimited STRING, in BOTH
 *                directions: the write side JOINS (`["a","b"]` -> `"a b"`,
 *                `[]` -> `""`) and the read side SPLITS — the RFC 6749 §3.3
 *                spelling. `scope` alone (RFC 8693 §4.2).
 *   - `"strict"` the wire carries the array itself; a scalar on read decodes
 *                to `undefined`.
 *   - `"wrap"`   the wire carries the array; a scalar on read WRAPS to a
 *                single-element array — `aud` alone, which is string-OR-array
 *                on the wire (RFC 7519 §4.1.3).
 */
export type ArrayScalar = "spaced" | "strict" | "wrap";

/**
 * Sub-kind of a `bespoke` claim — the discriminator telling the translator and the
 * COSE byte-shaper WHICH per-claim builder to use.
 *
 * ⚠ NEITHER MEMBER IS WAITING ITS TURN AT THE MEMBER-SET MECHANISM.
 *
 * `"confirmation"` — `cnf` HAS declared members (`internal/claims/cnf-members.ts`),
 * but its COSE form needs a per-claim BUILDER (RFC 8747 §3.1): the embedded key's
 * VALUE is transcoded, where a declared member set carries values through
 * unchanged, and a JWK is a union discriminated by `kty` whose labels collide
 * (`AKP.pub` is -1, `EC.crv` is -1) — the same reason `jwk`/`epk` have no children.
 *
 * `"events"` — the claim's keys are event-statement URIs rather than field names
 * (RFC 8417 §2.2), so every key is the producer's. A member set answers "what
 * becomes of a member the registry does not declare", and there are none for that
 * question to be about. The URI check is a PROFILE rule
 * (`internal/utils/rules/events-shape.ts`).
 */
export type BespokeKind = "confirmation" | "events";

/**
 * How a claim's VALUE is shaped. A CLOSED union, kept separate from the header
 * codec union so both translators keep an exhaustive `switch` with a `never`
 * default.
 *   - `"text"`    string scalar (iss, sub, acr…)
 *   - `"int"`     plain number, no transform
 *   - `"date"`    NumericDate: domain `Date` <-> wire Unix-seconds int
 *   - `"bool"`    boolean scalar
 *   - `"bstr"`    byte string — a PER-WIRE codec only; no claim carries it as its
 *                 base codec, because JOSE has no byte strings
 *   - `"array"`   array of strings with its scalar-tolerance policy — or, with
 *                 `of`, an array of DECLARED STRUCTURES
 *   - `"object"`  a DECLARED structure — see {@link ObjectCodec}
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
   *   - `"b64u"` the string IS base64url and the bytes are what it decodes to.
   *
   * ⚠ REQUIRED, with no default: the two alphabets are indistinguishable at the type
   * level and silently produce DIFFERENT bytes on a signed wire. It is a SELECTOR,
   * not a value forwarded to `@lindorm/cbor` — `"utf8"` resolves to a bespoke
   * encode/decode pair (`internal/cose/cwt-spec.ts`).
   */
  | { kind: "bstr"; encoding: "utf8" | "b64u" }
  /**
   * An array of STRINGS. `of: undefined` is written out rather than omitted so
   * the two array forms DISCRIMINATE: without it `codec.of` is not a readable
   * property on the union at all, and both translators would need a cast to tell
   * an array of strings from an array of structures.
   */
  | { kind: "array"; scalar: ArrayScalar; of?: undefined }
  /**
   * An array of DECLARED STRUCTURES — RFC 9396 `authorization_details`, whose
   * elements are objects rather than strings.
   *
   * ⚠ IT CARRIES NO `scalar`, AND THE ABSENCE IS THE POINT. {@link ArrayScalar}
   * answers "what does a SCALAR on read become", and all three answers are about
   * strings — none can produce a STRUCTURE. A value that is not a collection of
   * structures is refused by the walker, not by a policy cell. Pinning the column
   * to one literal instead would leave a cell nothing reads (`translate.ts`
   * branches on `of` before reaching `scalar`, and `cwt-spec.ts` never reads it).
   */
  | { kind: "array"; of: ObjectCodec }
  | ObjectCodec
  | { kind: "bespoke"; bespoke: BespokeKind };

/**
 * A MEMBER of a structured claim: {@link MemberSpec} instantiated at the claim
 * registry's own codec union.
 *
 * Recursive by construction — a member's `codec` may itself be an
 * {@link ObjectCodec}, which is how a structure nests.
 */
export type ClaimMemberSpec = MemberSpec<unknown, ClaimCodec, "keep" | "prune">;

/**
 * A claim value with a DECLARED member set.
 *
 * ⚠ `children` IS A THUNK for two load-bearing reasons: the actor chain is
 * SELF-REFERENTIAL — an `act` contains an `act` (RFC 8693 §4.1) — which a direct
 * array cannot express without a mutable binding; and deferring evaluation lets a
 * member set be declared in a module the registry imports without a cycle.
 *
 * `open` says what becomes of a member the registry does NOT declare:
 *   - `"closed"`   REFUSED — an undeclared member has no wire spelling and no value
 *                  shape, so nothing can be said about it.
 *   - `"flip"`     CARRIED with the mechanical key case flip (snake on write, camel
 *                  on read), because the tail is in LINDORM's vocabulary.
 *   - `"verbatim"` CARRIED UNTOUCHED at every depth, because the tail is in a
 *                  FOREIGN vocabulary a case flip would corrupt — an
 *                  `authorization_details` element's own fields (RFC 9396 §2).
 *
 * ⚠ THE CELL IS REQUIRED so a new structure cannot forget to answer. `open` sits on
 * the CODEC and a NESTED member declares its OWN, so an omitted cell would decide
 * one depth silently while the depth above said something else.
 *
 * ⚠⚠ A CLOSED SET REFUSES AN UNDECLARED MEMBER; IT DOES NOT DROP IT. A drop is
 * unobservable in both directions, so a closed set that dropped would be strictly
 * weaker than a hand-written rule. The walker reports the member NAME and its FULL
 * PATH (`act.act.surprise`).
 *
 * ⛔⛔ `"closed"` HAS NO REGISTERED USER, AND THIS IS WHERE THAT IS SAID. Every
 * structure the registry declares is open, and the two candidates are ruled out by
 * their own specifications (RFC 8693 §4.1, RFC 8693 §4.4; RFC 7800 §3.1, RFC 7800 §6.2.2). ⇒ THE
 * CONDITION THAT WOULD CHANGE IT: a claim whose specification ENUMERATES its
 * members and FORBIDS the rest. Until one is registered the arm is carried by the
 * walker's unit pins alone (`internal/claims/translate.test.ts`).
 *
 * ⭐⭐ AN OPEN SET IS ONLY SAFE BECAUSE A KEY COLLISION IS REFUSED. The tail writes
 * into the same bag as the declared members, so a tail member resolving to a
 * declared member's key would otherwise be settled by KEY ORDER — for an identity
 * claim that is an attack, letting an open `act` carry
 * `{ sub: "audited-service", subject: "rogue-service" }` and naming whichever the
 * token's own key order puts last. `internal/claims/translate.ts` refuses the
 * collision in BOTH directions and for EVERY open set.
 *
 * pinned: claims-registry.test.ts, "each declared structure states what becomes of
 * a member it does not declare".
 */
export type ObjectCodec = {
  kind: "object";
  children: () => ReadonlyArray<ClaimMemberSpec>;
  open: "closed" | "flip" | "verbatim";
};

export type ClaimSpec<D = unknown> = ParamSpec<D, ClaimCodec, WhenEmpty> & {
  /**
   * VALIDATION-temporal direction — set ONLY on the time claims the verifier
   * range-checks against "now", the single source of truth for the temporal
   * matcher set. ⚠ NOT every `date` claim: `updatedAt` is a date but a profile
   * timestamp, not validation-temporal, so it carries no mark.
   *   - `"past"`    must not be in the future (value <= now + tolerance).
   *   - `"future"`  must not be in the past (value >= now - tolerance).
   */
  temporal?: "past" | "future";
  /**
   * Which read-side bucket the claim lands in:
   *   - `"claims"`  the standard/protocol claim set.
   *   - `"profile"` the OIDC Core §5.1 profile set (`AegisProfile`).
   * A claim NOT in the registry buckets to `custom`, so `custom` is the ABSENCE of
   * an entry and never a bucket value. SENSITIVITY is a SEPARATE column
   * ({@link ClaimSpec.sensitivity}) so the two facts compose.
   */
  bucket: "claims" | "profile";
  /** See {@link Sensitivity}. */
  sensitivity: Sensitivity;
  /**
   * The claim is part of `DomainClaims`, so the verify-FLOOR read resolves it to its
   * domain name. Absent ⇒ the floor leaves it in `custom` under its wire spelling.
   *
   * ⚠ NOT part of the shared {@link ParamSpec} base: it is a CLAIM-only fact, and it
   * is what the verify-floor read scopes itself by — a narrower set than the domain
   * read resolves (see `ClaimReadMode`).
   *
   * pinned: claims-registry.test.ts binds the mark and the `DomainClaims` type to
   * each other in BOTH directions.
   */
  domainClaim?: true;
};
