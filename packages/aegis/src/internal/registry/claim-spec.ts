/**
 * The CLAIM half of the shared {@link ParamSpec} base — the payload-side twin of
 * {@link HeaderSpec}. Three fields beyond the base — `temporal`, `bucket` and
 * `domainClaim` — each meaningless for a header parameter, which is why they
 * live here rather than on the base.
 */

import type { MemberSpec, ParamSpec } from "./param-spec.js";

/**
 * How an array claim tolerates a SCALAR on read. Required on every `array`
 * codec; the three cases are exhaustive and none of them is a default.
 *   - `"spaced"` a space-delimited STRING is accepted and SPLIT (`"a b"` ->
 *                `["a","b"]`), the RFC 6749 §3.3 spelling.
 *   - `"strict"` arrays ONLY; a scalar decodes to `undefined`.
 *   - `"wrap"`   a scalar WRAPS to a single-element array — `aud` alone, because
 *                RFC 7519 §4.1.3 defines it as string-OR-array.
 */
export type ArrayScalar = "spaced" | "strict" | "wrap";

/**
 * Sub-kind of a `bespoke` claim — the discriminator telling the translator and
 * the COSE byte-shaper WHICH per-claim builder to use.
 *
 * ⚠ NEITHER MEMBER IS WAITING ITS TURN AT THE MEMBER-SET MECHANISM; both are
 * here on their own merits, and the reasons are durable rather than deferrals.
 *
 * `"confirmation"` — RFC 7800 `cnf` HAS declared members
 * (`internal/claims/cnf-members.ts`), but its COSE form needs a per-claim
 * BUILDER: RFC 8747 §3.1 carries the embedded key as a COSE_Key, so the member's
 * VALUE is transcoded where a declared member set carries values through
 * unchanged — and a JWK is a union discriminated by `kty` whose labels collide
 * (`AKP.pub` is -1, `EC.crv` is -1), the same reason the header registry's
 * `jwk`/`epk` have no children. Three of the five members have no COSE form at
 * all, and the generic walker cannot key a member the wire does not name
 * (`coseName` throws), so that refusal belongs to the byte layer.
 *
 * `"events"` — RFC 8417 §2.2 defines the claim's keys as URIs identifying event
 * statements, i.e. identifiers rather than field names, so every key is the
 * producer's and always will be. A member set answers "what becomes of a member
 * the registry does not declare", and there are no members for that question to
 * be about: `children: () => []` would read as "none declared YET" where the
 * truth is "there are none to declare", and no cell distinguishes those. The URI
 * check is a PROFILE rule and stays there
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
   *   - `"b64u"` the string IS base64url and the bytes are what it decodes to —
   *              a 43-char `at_hash` is 32 bytes on COSE.
   *
   * ⚠ REQUIRED, with no default. The two alphabets are indistinguishable at the
   * type level and silently produce DIFFERENT bytes on a signed wire, so there
   * is nothing safe to fall into. It is a SELECTOR, not a value forwarded to
   * `@lindorm/cbor`: `CborField.encoding` has no `"utf8"` member, and `"utf8"`
   * resolves to a bespoke encode/decode pair (`internal/cose/cwt-spec.ts`).
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
 * registry's own codec union and its own emptiness verdicts, so a member is
 * described in exactly the vocabulary a claim is.
 *
 * Recursive by construction — a member's `codec` may itself be an
 * {@link ObjectCodec}, which is how a structure nests.
 */
export type ClaimMemberSpec = MemberSpec<unknown, ClaimCodec, "keep" | "prune">;

/**
 * A claim value with a DECLARED member set.
 *
 * ⚠ `children` IS A THUNK for two load-bearing reasons: RFC 8693 §4.1 defines
 * the actor chain recursively — an `act` contains an `act` — so the declaration
 * is SELF-REFERENTIAL and a direct array cannot be written in TypeScript without
 * a mutable binding; and deferring evaluation lets a member set be declared in a
 * module the registry itself imports without an initialisation cycle.
 *
 * `open` says what becomes of a member the registry does NOT declare, and it is
 * a THREE-WAY answer because "carried" is not one disposition but two:
 *   - `"closed"`   REFUSED — an undeclared member has no wire spelling and no
 *                  value shape, so nothing can be said about it.
 *   - `"flip"`     CARRIED with the mechanical key case flip (snake on write,
 *                  camel on read). The tail is in LINDORM's vocabulary: an
 *                  undeclared `address` member is a lindorm extension of a
 *                  lindorm type.
 *   - `"verbatim"` CARRIED UNTOUCHED, at every depth, because the tail is in a
 *                  FOREIGN vocabulary a case flip would corrupt rather than
 *                  translate. RFC 9396 §2 makes an `authorization_details`
 *                  element's `type` determine its allowable contents, and RFC
 *                  9396's own Figure 2 names them `instructedAmount`,
 *                  `creditorName` and `creditorAccount` — fields snake_case would
 *                  rewrite into ones no resource server is looking for.
 *
 * ⚠ THE CELL IS REQUIRED so a new structure cannot forget to answer. `open` sits
 * on the CODEC and a NESTED member declares its OWN, so an omitted cell decides
 * one depth silently while the depth above says something else.
 *
 * ⚠⚠ A CLOSED SET REFUSES AN UNDECLARED MEMBER; IT DOES NOT DROP IT. A drop is
 * unobservable in both directions — a caller's member vanishes from a signed
 * token with nothing said, and a stranger's token is reported as saying less than
 * it says — so a closed set that dropped would be strictly weaker than a
 * hand-written rule. The walker reports the member NAME and its FULL PATH
 * (`act.act.surprise`).
 *
 * ⛔⛔ `"closed"` HAS NO REGISTERED USER, AND THIS IS WHERE THAT IS SAID. Every
 * structure the registry declares is open, and the two candidates are ruled out
 * by their own specifications: RFC 8693 §4.1 defines the actor's members as
 * "claims that identify the actor" and §4.4 offers `email` as one; RFC 7800 §3.1
 * says "Other members of the 'cnf' object may be defined" and "all confirmation
 * members that are not understood by implementations MUST be ignored", with §6.2
 * establishing an IANA registry whose §6.2.2 initial contents already name a
 * member aegis does not carry (`jwe`). ⇒ THE CONDITION THAT WOULD CHANGE IT: a
 * claim whose specification ENUMERATES its members and FORBIDS the rest. Until
 * one is registered the arm is carried by the walker's unit pins alone
 * (`internal/claims/translate.test.ts`, "a CLOSED member set").
 *
 * ⭐⭐ AN OPEN SET IS ONLY SAFE BECAUSE A KEY COLLISION IS REFUSED. The tail
 * writes into the same bag as the declared members, so a tail member whose
 * resolved key equals a declared member's would otherwise be settled by KEY ORDER
 * — measured on this registry:
 * `Aegis.toDomain({ address: { street_address: "DECLARED", streetAddress: "SHADOW" } })`
 * yielded `{ streetAddress: "SHADOW" }`. For an identity claim that is an attack:
 * an open `act` lets `{ sub: "audited-service", subject: "rogue-service" }` name
 * whichever actor the token's own key order puts last.
 * `internal/claims/translate.ts` refuses the collision in BOTH directions and for
 * EVERY open set, naming the key the two members resolved to.
 *
 * pinned: claims-registry.test.ts, "each declared structure states what becomes
 * of a member it does not declare" — every structure at every depth, so opening
 * or closing one cannot happen quietly.
 */
export type ObjectCodec = {
  kind: "object";
  children: () => ReadonlyArray<ClaimMemberSpec>;
  open: "closed" | "flip" | "verbatim";
};

/**
 * ⚠ NARROWED to `"keep" | "prune"`: `refuse` is a HEADER verdict, and the third
 * type parameter is what says so — a runtime loop over the column could only
 * restate what the compiler already refuses, so there is none.
 *
 * The reason is that `refuse` is a verdict about the EMISSION BOUNDARY, and the
 * two sides do not have the same boundary to speak from. A header parameter is
 * written by aegis itself at the moment of assembly, so the boundary is the only
 * place that sees it and a throw there is the earliest possible repair point. A
 * claim arrives from a caller who was ALREADY answered a layer up, in its own
 * vocabulary and with the claim's DOMAIN name in the error — so the emission
 * prune is the later and blinder of the two places to speak, not the only one.
 * Which claims that layer speaks about is a PROFILE decision: see the `whenEmpty`
 * note in `claims-registry.ts`.
 *
 * ⚠ The profile floor does NOT cover the gap. It refuses an empty value only for
 * the claims some profile names in a `required`/`forbidden`/shape rule, and a
 * claim no profile mentions is refused nowhere at all.
 */
export type ClaimSpec<D = unknown> = ParamSpec<D, ClaimCodec, "keep" | "prune"> & {
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
   *   - `"claims"`  the standard/protocol claim set (RFC / OIDC top-level).
   *   - `"profile"` the OIDC Core §5.1 profile set (`AegisProfile`).
   * A claim NOT in the registry buckets to `custom`, so `custom` is the ABSENCE
   * of an entry and never a bucket value. SENSITIVITY is a SEPARATE column
   * ({@link ParamSpec.sensitivity}) so the two facts compose instead of a
   * three-way category forcing a choice between them.
   */
  bucket: "claims" | "profile";
  /**
   * The claim is part of `DomainClaims`, so the verify-FLOOR read resolves it to
   * its domain name. Absent ⇒ it is not (SET-only `events`/`txn`, profile,
   * sensitive), and the floor leaves it in `custom` under its wire spelling.
   *
   * ⚠ NOT part of the shared {@link ParamSpec} base: it is a CLAIM-only fact, and
   * it is what the verify-floor read scopes itself by — that read resolves a
   * narrower set than the domain read does (see `ClaimReadMode`), so collapsing
   * the two is a policy decision belonging to the verify rewrite.
   *
   * pinned: claims-registry.test.ts binds the mark and the `DomainClaims` type to
   * each other in BOTH directions, so they cannot drift apart silently.
   */
  domainClaim?: true;
};
