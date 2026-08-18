/**
 * The claim-rule layer — the pure predicates a profile policy is assembled from.
 *
 * --- FOUR presence notions, and none of them is another ---
 *
 *   demand  "is there something to bite on?"  isClaimSatisfied  aegis
 *   vocab   "did the author name this key?"   isClaimOmitted    aegis
 *   stated  "was a value stated at all?"      isNotStated       aegis
 *   null    "is the value non-null?"          $exists           @lindorm/match
 *
 * A profile author holds the first, second and fourth at once — `required`/
 * `atLeastOneOf`/`requiredWhen` read the demand notion, `forbidden` and every
 * shape rule's entry guard read the vocabulary one, and a `match` condition
 * written with `$exists` reads the null one — so they are named here instead of
 * left for each reader to rediscover.
 *
 * ⚠ THE THIRD IS NOT A RULE-LAYER NOTION AND IS NAMED HERE ANYWAY. `isNotStated`
 * (`internal/claims/is-not-stated.ts`) is the CODEC's question, asked by the
 * translator about one position: `undefined` and `null` are absence, everything
 * else was stated. It is listed because it sits exactly between the two aegis
 * notions above — stricter than `isClaimOmitted`, which counts a written `null`
 * as present, and looser than `isClaimSatisfied`, which counts `""`, `[]` and
 * `{}` as absent — so a reader holding either of those would otherwise assume it
 * is one of them. It is not exported from this barrel: a profile rule must not
 * reach for it, because a rule asking "was this stated?" of a bag the translator
 * has already emptied of unstated positions is asking a question with one answer.
 *
 * ⛔⛔ AND THE THIRD HAS ONE EXCEPTION, NAMED HERE SO THE TABLE IS ACTUALLY
 * COMPLETE. A `cnf` MEMBER does not take it: `internal/claims/translate.ts`'s
 * `walkConfirmation` asks `=== undefined` — the VOCABULARY notion — on both its
 * declared and its tail arm, and `internal/cose/cose-key.ts` states the same
 * verdict at the byte layer ("`null` is deliberately NOT absent. It is a value,
 * and not one this codec can write"). Two files, one rule, and it is a security
 * property rather than an oversight: an erased null `jkt` slipped past the COSE
 * fail-closed guard (which tests `!== undefined`) and MINTED an unbound CWT that
 * verified with no proof, byte-identical to a legitimate key-id binding. RFC 9449
 * §6.1 types the member by MUST — the `jkt` value "MUST be the base64url encoding
 * (as defined in [RFC7515]) of the JWK SHA-256 Thumbprint" — so a null one
 * contradicts its declaration rather than leaving the position unfilled. (NOT RFC
 * 7800 §3.1: that defines the `cnf` container, not this member.) ⇒ Four notions and one exception is
 * the whole map; do not "unify" the exception away.
 *
 * The first two were ONE predicate until they could not be. `isClaimAbsent`
 * counted `undefined | null | ""` and was consumed at BOTH polarities, so it had
 * to serve as a floor for `required` and a ceiling for `forbidden` at the same
 * time, and it failed at both.
 *
 * `aud: []` satisfied `required: ["audience"]` in ALL TEN built-in profiles that
 * name `audience` in a presence rule — `access_token`, `delegation`,
 * `erasure_token`, `external_access_token`, `id_token`, `introspection`, `jarm`,
 * `logout_token`, `security_event`, `userinfo`. NINE of those had nothing else
 * catching it; `access_token` alone was saved by `AUD_SINGLE_RESOURCE`
 * (`$length: 1`, `definitions/rule-predicates.ts`), which is a CARDINALITY
 * predicate and not a presence one — relax that profile to multiple audiences
 * and the number is ten either way.
 *
 * And `at_hash: ""` passed `forbidden` on `external_access_token` — the
 * id-token defence that profile leans on, with no structural discriminator left
 * behind it.
 *
 * ⚠ `$exists` means NOT NULL by design (`@lindorm/match`,
 * `constants/operators.ts`), NOT "the key is present". `ISSUER_IS_URI` and
 * `AUD_SINGLE_RESOURCE` are written against that meaning and a profile author
 * writing `$or: [{ $exists: false }, …]` is stating a null-check, not either
 * aegis notion. Not ours to change — ours to name.
 *
 * ⚠ `isClaimOmitted` is `=== undefined`, NOT `Object.hasOwn`, and that is
 * correct here even though `enforce-policy.ts` makes `Object.hasOwn`-never-`in`
 * doctrine for caller data. That rule governs a MEMBERSHIP test on a
 * caller-supplied KEY, where `in` walks `Object.prototype`. This is a VALUE
 * test, and the two states `Object.hasOwn` would separate cannot differ — but
 * note WHICH code establishes that, because the obvious answer is the wrong one:
 *   - MINT — `internal/utils/assemble-common-claims.ts` builds the bag the
 *     enforcer is handed, skipping every `undefined` value and `omitUndefined`-ing
 *     the result, so no key reaches `enforcePolicy` holding `undefined`.
 *   - VERIFY — `internal/claims/translate.ts` writes a decoded claim only when it
 *     decoded to something, then `omitUndefined`s the bag; and neither JSON nor
 *     CBOR can express `undefined`, so a key a token carries has a real value.
 * ⛔ NOT `internal/utils/normalise-claims.ts`, whose `omitUndefined` runs at
 * SERIALISATION — after the mint policy has already been enforced
 * (`mint-token.ts` calls `enforcePolicy` before any wire assembly). It reaches
 * the same state; it is not what establishes it here.
 *
 * ⚠ EVERY DEPTH, not just the top level. A shape rule reading `subjectId.id` or
 * `act.subject` is asking the same two questions of the same caller-supplied
 * claim data, so it asks them with the same two predicates — there is no
 * "top-level claims only" boundary to remember, and the member-level reads that
 * kept a bare `=== undefined` were not a boundary, they were the leftovers. The
 * distinction that DOES matter at member level is the same one as at the top: a
 * format's REQUIRED member is a demand (`subjectId.id` of `""` identifies nobody,
 * so `isClaimSatisfied`), while a validate-it-when-present member is vocabulary
 * (`act.subject`, `cnf.thumbprint`, so `isClaimOmitted`).
 *
 * ⚠ Shape rules are OPT-IN PER PROFILE (`{ rule: "shape", shape: … }`), so what
 * they defend, they defend only where a profile declares them. `events` and
 * `subjectId` refuse their empty-object form through `eventsShape` / `subIdShape`
 * rather than through the presence rule, and that holds only because every
 * built-in profile requiring either also declares the matching shape rule. A
 * consumer-registered profile that requires one and declares no shape rule has
 * the presence rule alone.
 */

export * from "./act-chain-shape.js";
export * from "./alg-permitted.js";
export * from "./at-least-one-of.js";
export * from "./cnf-shape.js";
export * from "./cross-field.js";
export * from "./events-shape.js";
export * from "./forbid-present.js";
export * from "./is-claim-omitted.js";
export * from "./is-claim-satisfied.js";
export * from "./match-condition.js";
export * from "./require-present.js";
export * from "./required-when.js";
export * from "./sub-id-shape.js";
