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

import type { MemberSpec, ParamSpec } from "./param-spec.js";

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
 *   - `"events"`       RFC 8417 SET `events` map (carried verbatim).
 *
 * ⭐⭐ BOTH SURVIVING MEMBERS WERE EXAMINED FOR THE MEMBER-SET MIGRATION AND BOTH
 * WERE KEPT ON THEIR MERITS. Five structured claims moved onto {@link ObjectCodec}
 * (`address`, `authorization_details`, `act`/`may_act`, `sub_id`); the two below
 * are described honestly instead. `events` has no members to declare (see the note
 * further down). `cnf` HAS members — and they are declared, in one place, at
 * `internal/claims/cnf-members.ts` — but its COSE form needs a per-claim BUILDER,
 * which is what this kind means:
 *   - RFC 8747 §3.1 carries the embedded key as a COSE_Key, so the member's VALUE
 *     is transcoded (a JWK becomes an integer-labelled CBOR map) where every
 *     declared member set carries its values through unchanged — and a JWK is a
 *     union DISCRIMINATED BY `kty` whose labels collide (`AKP.pub` is -1 and
 *     `EC.crv` is -1), the same reason the header registry's `jwk`/`epk` have no
 *     children ({@link MemberSpec}).
 *   - RFC 8747's labels are IANA-REGISTERED, so the COSE cnf map must ride on
 *     every token; `internal/cose/cwt-spec.ts`'s derived label map is gated on
 *     `proprietary` because the labels it was built for are lindorm's own.
 *   - Three of the five members have NO COSE form at all, and the generic walker
 *     cannot key a member the wire does not name (`coseName` throws), while the
 *     raw `aegis.cwt.sign` door bypasses the translator entirely — so the refusal
 *     belongs to the byte layer, where it already is.
 * ⇒ What the migration was FOR — one declaration instead of five hand-kept copies
 * — is delivered by `cnf-members.ts`. What it could not deliver is a generic
 * codec, and `bespoke` is the registry's word for exactly that.
 *
 * ⚠ There WAS an `"address"` member, for the OIDC Core §5.1.1 address — and it
 * was not a builder either. Its two arms were a blanket `snakeKeys` on write and
 * `camelKeys` on read: a case flip over whatever the caller happened to supply,
 * with no member set recorded anywhere and nothing that could state a member's
 * wire spelling, its value shape or its empty form. That is a STRUCTURE fact the
 * registry could not hold, and it now holds it — `address` declares
 * {@link ObjectCodec} children, and the generic walker in
 * `internal/claims/translate.ts` reproduces the flip from the declaration
 * instead of performing it blind.
 *
 * ⚠ There WAS also a `"hash"` member, for the OIDC hashes — and it was not a
 * builder at all. Both translator arms were byte-for-byte the `"text"` arm
 * (`return value` on encode, `isString(value) ? value : undefined` on decode);
 * the sub-kind existed to key ONE COSE byte shape. That is a CODEC fact, not a
 * structure fact, and the registry already had the mechanism for it — the
 * per-wire codec `tokenId` uses. The hashes are `kind: "text"` with a
 * `per: { cose: { kind: "bstr", encoding: "b64u" } }` override now, and a
 * "bespoke" kind that is a codec gap rather than a structure gap has nowhere
 * left to hide.
 *
 * ⚠ THERE WAS ALSO AN `"authDetails"` MEMBER, for the RFC 9396
 * `authorization_details` array, and its two arms were `isArray(value) ? value
 * : undefined` in BOTH directions — a type test standing in for a structure.
 * The claim is a COLLECTION OF STRUCTURES, and the two facts that matters most
 * about it could not be written down: that RFC 9396 §2 makes `type` REQUIRED on
 * every element, and that an element's remaining fields belong to whoever
 * registers that type and must therefore travel with their spelling UNTOUCHED.
 * The first was stated a layer away as a profile `shape` rule one profile opted
 * into; the second was stated nowhere and held only because the passthrough
 * happened to touch nothing. Both are registry facts now — `{ kind: "array",
 * of: … }` with a {@link ClaimMemberSpec.required} member and `open: "verbatim"`.
 * ⚠ NO `scalar`, and the omission is deliberate — see the note on that arm of
 * {@link ClaimCodec}. This paragraph said `scalar: "strict"` while the declaration
 * eleven lines down carries none and the arm beside it argues at length that the
 * cell must not exist: one file contradicting itself about its own registry.
 *
 * ⚠⚠ AND THERE WAS AN `"act"` MEMBER, for the RFC 8693 `act`/`may_act` actor
 * chain — the RECURSIVE one, and the only sub-kind whose builders genuinely
 * described a structure rather than standing in for one. It is gone for the same
 * reason the others are: the two builders wrote FIVE member spellings out by hand
 * on the domain side (`sub`/`iss`/`aud`/`client_id`/`act`) and a THIRD copy of
 * them on the COSE side as an integer label table, and neither copy could state
 * the members' value shapes, their empty forms or their samples.
 *
 * ⭐ IT IS ALSO THE MIGRATION THAT PROVED THE MECHANISM RECURSES. `children` is a
 * THUNK, so an `act` member set can name ITSELF, and the three walks over a
 * member set — the translator, the CWT byte shaper, the registry's sample check —
 * each key a visited set on that thunk. Nothing about the walker had to change to
 * carry a chain of arbitrary depth.
 *
 * ⚠ It also cost a REFUSAL and gained a better one. The hand-written read-side
 * decoder accepted EITHER spelling at every level (`subject` or `sub`, `clientId`
 * or `client_id`) and PREFERRED the domain one, so a wire carrying the non-RFC
 * spelling was honoured as if it were RFC 8693's. The declared member set answers
 * to the wire spelling alone, and a token carrying BOTH is refused for the
 * collision rather than resolved by key order.
 *
 * ⚠⚠ AND THERE WAS A `"subId"` MEMBER, for the RFC 9493 `sub_id` Subject
 * Identifier — the emptiest of them all. BOTH translator arms were
 * `isObject(value) ? value : undefined`: a type test with no member handling at
 * any depth, in either direction. What the passthrough hid is that a Subject
 * Identifier's members were the WIRE's own names sitting in a DOMAIN-keyed bag —
 * a caller wrote `subjectId.phone_number` while every other structured claim took
 * `streetAddress` / `clientId` — and nothing anywhere recorded that, because with
 * one spelling for both wires there was nothing to record it IN.
 *
 * ⭐⭐ IT IS ALSO THE MIGRATION THAT PROVED THE MECHANISM RECURSES THROUGH AN
 * ARRAY OF ITSELF. RFC 9493 §3.2.8 defines the `aliases` format's `identifiers`
 * member as "a JSON array containing one or more Subject Identifiers", so the
 * member set names ITSELF through `{ kind: "array", of: … }` rather than through
 * `{ kind: "object" }` — a different path in every walker (`walkElements` rather
 * than `walkObject`, `StructureForm: "collection"` rather than `"single"`,
 * `CompactSpec.nested.array`). Nothing about any of them had to change.
 *
 * ⚠ It ALSO made a previously equivalent mutant live. `WalkContext.claim` is read
 * below depth 1 in exactly one place — `walkElements`'s non-array message — which
 * needs a MEMBER whose codec is `array` WITH `of`, and until `sub_id` migrated no
 * declared member had one. `sub_id.identifiers` is that member, so a walker that
 * overwrote `claim` with the member's own domain now reports the wrong claim, and
 * `classes/sub-id-claim-wire.test.ts` pins it.
 */
/**
 * ⭐⭐ `"events"` WAS EXAMINED FOR THE SAME MIGRATION AND DELIBERATELY KEPT — the
 * one member of this union that is not waiting its turn. Five structures migrated;
 * this one is described honestly instead, and the reason is durable rather than a
 * deferral:
 *
 * ⚠ A MEMBER SET ANSWERS "WHAT BECOMES OF A MEMBER THE REGISTRY DOES NOT
 * DECLARE", AND `events` HAS NO MEMBERS FOR THAT QUESTION TO BE ABOUT. RFC 8417
 * §2.2 defines the claim's keys as URIs identifying event statements —
 * identifiers, not field names — so every key is the producer's and always will
 * be. The declaration that fits the existing mechanism is
 * `{ kind: "object", children: () => [], open: "verbatim" }`, and it is a WORSE
 * statement than the one it would replace: `children: () => []` reads as "no
 * members are declared YET" where the truth is "there are none to declare", and no
 * cell here distinguishes those. {@link ObjectCodec}'s `open` is a TAIL column, and
 * a structure that is all tail is not a structure.
 *
 * ⚠ THE ALTERNATIVE — A SECOND CODEC FORM, `{ kind: "map"; keyFormat: "uri";
 * value: "verbatim" }` — WAS MEASURED AGAINST THIS REGISTRY'S OWN TEST (a column
 * that answers a question the code is already asking is load-bearing; one invented
 * to look complete is not), AND HAS NO READER:
 *   - `keyFormat` would be read by NOTHING. The URI check is a PROFILE rule and
 *     stays there (`internal/utils/rules/events-shape.ts`, bound by `logout_token`
 *     / `erasure_token` / `security_event`); a codec restating it would be a
 *     second copy of one fact.
 *   - `value` would be single-valued. `events` is the registry's only open-keyed
 *     map and no claim wants a case-flipped one, so the cell has one legal entry
 *     — which is not a column.
 *   - The COSE shaper would NOT gain a derivation. `shapeForObject` returns its
 *     verbatim shape when no member carries an integer label; a form with no
 *     member set would derive that from an EMPTY list, which is true of any empty
 *     list. A hand-written `case "map"` in `fieldForClaim` is the same
 *     hand-written arm `shapeForBespoke`'s `case "events"` already is, one switch
 *     further up.
 *   - The arm count is unchanged: three switches would gain an arm (`encodeValue`,
 *     `decodeValue`, `fieldForClaim`) and three would lose one (`encodeBespoke`,
 *     `decodeBespoke`, `shapeForBespoke`).
 * ⇒ What is left of the second form is `{ kind: "map" }`, which is
 * `bespoke: "events"` under a different name.
 *
 * ⛔ COLLAPSING THIS UNION TO ONE MEMBER IS NOT AN ARGUMENT EITHER. `bespoke`
 * states that a claim needs a per-claim builder, and `events` has one: an
 * `isObject` guard on both sides, and a decoder that must NOT case-convert its
 * keys, stated where it can be read. A one-member union says the same thing about
 * a smaller set; it does not say it more honestly.
 *
 * ⚠ THE `__proto__` REFUSAL WAS NOT THE DECIDING READER EITHER, AND IT LOOKED
 * LIKE ONE. `events` was the passthrough where that hole was first measured, so a
 * member set — which brings the walker, which carried the refusal — read as the
 * fix. It was not: the same hole was live on `sub_id` and `authorization_details`,
 * both ALREADY on the member set, through their `open: "verbatim"` tails, and on
 * `email_verified`, a `bool` claim with no structure near it. The refusal is a
 * CLAIM-level rule now (`internal/claims/proto-member-violations.ts`) and owes
 * nothing to any codec kind.
 */
export type BespokeKind = "confirmation" | "events";

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
 *   - `"array"`   array of strings, with its scalar-tolerance policy — or, with
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
  /**
   * An array of STRINGS. `of: undefined` is written out rather than omitted so
   * the two array forms DISCRIMINATE: without it, `codec.of` is not a readable
   * property on the union at all and both translators would have to reach for a
   * cast to tell an array of strings from an array of structures.
   */
  | { kind: "array"; scalar: ArrayScalar; of?: undefined }
  /**
   * An array of DECLARED STRUCTURES — RFC 9396 `authorization_details`, whose
   * elements are objects rather than strings.
   *
   * ⚠ IT CARRIES NO `scalar`, AND THE ABSENCE IS THE POINT. {@link ArrayScalar}
   * answers "what does a SCALAR on read become", and all three of its answers
   * are about strings: `"spaced"` splits one into many, `"wrap"` makes one into
   * a single-element array, `"strict"` drops it. None can produce a STRUCTURE,
   * so there is no tolerance question to answer here — a value that is not a
   * collection of structures is refused, and by the walker, not by a policy
   * cell. Pinning the column to one literal instead would leave a cell nothing
   * reads (`translate.ts` branches on `of` before ever reaching `scalar`, and
   * `cwt-spec.ts` never reads it) and a test asserting what the compiler already
   * guarantees. Deleting the cell is the fix; constraining it is not.
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
 * ⚠ `children` IS A THUNK, and this is not a new invention: it is the shape
 * `internal/cose/compact-map.ts` already uses (`spec: () => CompactSpec`) for
 * the same problem, moved onto the registry so it can carry the four facts a
 * member has beyond its integer label. Two reasons, both load-bearing:
 *   1. RFC 8693 §4.1 defines the actor chain recursively — an `act` contains an
 *      `act` — so the declaration is SELF-REFERENTIAL and a direct array cannot
 *      be written in TypeScript without a mutable binding.
 *   2. It defers evaluation to first use, so a member set may be declared in a
 *      module the registry itself imports without an initialisation cycle.
 *
 * `open` says what becomes of a member the registry does NOT declare, and it is
 * a THREE-WAY answer because "carried" is not one disposition but two:
 *   - `"closed"`  the member set is CLOSED — an undeclared member has no wire
 *                 spelling and no value shape, so nothing can be said about it,
 *                 and it is REFUSED.
 *   - `"flip"`    undeclared members are CARRIED, with the mechanical key case
 *                 flip every unregistered claim gets (snake on write, camel on
 *                 read). The tail is in LINDORM's vocabulary: an undeclared
 *                 `address` member is a lindorm extension of a lindorm type, so
 *                 the house convention applies to it exactly as it applies to
 *                 the declared six.
 *   - `"verbatim"` undeclared members are CARRIED UNTOUCHED, at every depth.
 *                 The tail is in a FOREIGN vocabulary, defined by somebody else,
 *                 and a case flip would not translate it but corrupt it. RFC
 *                 9396 §2 makes an `authorization_details` element's `type`
 *                 determine that element's allowable contents, so the remaining
 *                 fields are the type registrant's to name — and RFC 9396's own
 *                 Figure 2 names them `instructedAmount`, `creditorName` and
 *                 `creditorAccount`, which snake_case would rewrite into fields
 *                 no resource server is looking for.
 *
 * ⚠ IT WAS `open?: true`, MEANING THE FLIP, and it had to widen the moment a
 * second structure migrated. `true` recorded that the set was open and silently
 * also decided whose vocabulary the tail was in — one cell answering two
 * questions, with the second answer unstated and wrong for the very next claim.
 * The same distinction already exists one level up and is stated there in prose:
 * `internal/claims/translate.ts`'s `events` arm carries an RFC 8417 event map
 * verbatim because its keys are URIs, "identifiers, not field names".
 *
 * ⚠⚠ THE CELL IS REQUIRED, AND WHAT IT CLOSES IS THE SILENT DEFAULT — not any one
 * value. It was `open?:`, so an omitted cell MEANT closed, decided by omission and
 * stated nowhere. That is not a hypothetical: `open` sits on the CODEC and a
 * NESTED member declares its OWN, so this registry shipped an actor set that was
 * open at depth 1 and CLOSED at every depth below — the nested `act` member's
 * codec simply carried no cell — and nothing anywhere went red (measured: the
 * drift guard below was 37/37 green over it). A required cell means a new
 * structure CANNOT FORGET TO ANSWER, which is the property that matters; whether
 * every answer has a user today is the smaller and separate question below.
 * ⇒ A missing cell is now a COMPILE error, which is the only place this can be
 * caught for a structure nobody remembered to add to a test.
 *
 * ⚠⚠ A CLOSED SET REFUSES AN UNDECLARED MEMBER; IT DOES NOT DROP IT. That is the
 * load-bearing half of `"closed"`: a drop is unobservable in both directions — a
 * caller's member vanishes from a signed token with nothing said, and a
 * stranger's token is reported as saying less than it says — so a closed set that
 * dropped would be strictly weaker than the hand-written rule it replaces. The
 * walker reports the member NAME and its FULL PATH (`act.act.surprise`).
 *
 * ⛔⛔ `"closed"` HAS NO REGISTERED USER, AND THIS IS WHERE THAT IS SAID. Every
 * structure the registry declares is open, and the last two candidates were ruled
 * out by their own specifications. `act`/`mayAct` were closed for one step and RFC
 * 8693 reversed it: §4.1 defines the actor's members as "claims that identify the
 * actor" and §4.4 offers `email` as one, so refusing a conformant foreign token
 * was the worse fault. `cnf` was the remaining prospect, and RFC 7800 §3.1 says
 * the same thing more explicitly: "Other members of the 'cnf' object may be
 * defined", and "in the absence of such requirements, all confirmation members
 * that are not understood by implementations MUST be ignored" — with §6.2
 * establishing an IANA registry other specifications register into, whose §6.2.2
 * initial contents already name a member aegis does not carry (`jwe`). A closed
 * `cnf` would have refused a member RFC 7800 itself defines.
 * ⇒ THE CONDITION THAT WOULD CHANGE IT: a claim whose specification ENUMERATES
 * its members and FORBIDS the rest. RFC 7800 was expected to be that claim and is
 * not. Until such a claim is registered the arm is carried by the walker's own
 * unit pins alone (`internal/claims/translate.test.ts`, "a CLOSED member set") and
 * by nothing in the registry. A branch with no user that says so is honest; the
 * silent default it replaces was not.
 *
 * A registry-level drift guard freezes the answer for every structure at every
 * depth (`claims-registry.test.ts`, "what becomes of a member it does not
 * declare") — including `"closed"`, which is now a value it records rather than an
 * absence it has to infer — so opening or closing one cannot happen quietly.
 *
 * ⭐⭐ AN OPEN SET IS ONLY SAFE BECAUSE A KEY COLLISION IS REFUSED. The tail writes
 * into the same bag as the declared members, so a tail member whose resolved key
 * equals a declared member's resolved key would otherwise be settled by KEY ORDER
 * — measured on this very registry:
 * `Aegis.toDomain({ address: { street_address: "DECLARED", streetAddress: "SHADOW" } })`
 * yielded `{ streetAddress: "SHADOW" }`. For an identity claim that is an attack:
 * an open `act` lets `{ sub: "audited-service", subject: "rogue-service" }` name
 * whichever actor the token's own key order puts last. `internal/claims/translate.ts`
 * refuses the collision in BOTH directions and for EVERY open set, naming the key
 * the two members resolved to. This is the whole of the member-shadowing question,
 * closed rather than filed.
 *
 * RFC 9396 §2 forces `open` on `authorizationDetails` independently: the
 * registered `type` of an element determines that element's allowable contents, so
 * a closed element set would refuse every real request.
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
