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
 * A profile author holds the first, second and fourth at once — `required` /
 * `atLeastOneOf` / `requiredWhen` read the demand notion, `forbidden` and every
 * shape rule's entry guard read the vocabulary one, and a `match` condition
 * written with `$exists` reads the null one.
 *
 * ⚠ THE THIRD IS THE CODEC'S QUESTION, not a rule-layer one
 * (`internal/claims/is-not-stated.ts`), and is named here because it sits exactly
 * BETWEEN the two aegis notions: stricter than `isClaimOmitted`, which counts a
 * written `null` as present, and looser than `isClaimSatisfied`, which counts
 * `""`, `[]` and `{}` as absent. ⛔ It is NOT exported from this barrel — a rule
 * asking "was this stated?" of a bag the translator has already emptied of
 * unstated positions is asking a question with one answer.
 * ⛔ It has ONE exception, so the table is complete only with it: a `cnf` MEMBER
 * takes the VOCABULARY notion instead, at `translate.ts` and at
 * `internal/cose/cose-key.ts`. It is a security property; do not unify it away.
 *
 * ⚠ `$exists` means NOT NULL by design (`@lindorm/match`,
 * `constants/operators.ts`), NOT "the key is present". `ISSUER_IS_URI` and
 * `AUD_SINGLE_RESOURCE` are written against that meaning, so a profile author
 * writing `$or: [{ $exists: false }, …]` is stating a null-check and neither
 * aegis notion. Not ours to change — ours to name.
 *
 * ⚠ `isClaimOmitted` is `=== undefined`, NOT `Object.hasOwn`, and that is correct
 * even though `enforce-policy.ts` makes `Object.hasOwn`-never-`in` doctrine for
 * caller data: that rule governs a MEMBERSHIP test on a caller-supplied KEY,
 * where `in` walks `Object.prototype`. This is a VALUE test, and the two states
 * `Object.hasOwn` would separate cannot differ — but note WHICH code establishes
 * that, because the obvious answer is the wrong one:
 *   - MINT — `internal/utils/assemble-common-claims.ts` builds the bag the
 *     enforcer is handed, skipping every `undefined` and `omitUndefined`-ing the
 *     result, so no key reaches `enforcePolicy` holding `undefined`.
 *   - VERIFY — `internal/claims/translate.ts` writes a decoded claim only when it
 *     decoded to something, then `omitUndefined`s the bag; and neither JSON nor
 *     CBOR can express `undefined`.
 * ⛔ NOT `internal/utils/normalise-claims.ts`, whose `omitUndefined` runs at
 * SERIALISATION — after the mint policy has been enforced (`mint-token.ts` calls
 * `enforcePolicy` before any wire assembly). It reaches the same state; it is not
 * what establishes it here.
 *
 * ⚠ EVERY DEPTH, not just the top level: a shape rule reading `subjectId.id` or
 * `act.subject` asks the same two questions of the same caller-supplied data. The
 * distinction that matters at member level is the one that matters at the top — a
 * format's REQUIRED member is a demand (`subjectId.id` of `""` identifies nobody,
 * so `isClaimSatisfied`), a validate-it-when-present member is vocabulary
 * (`act.subject`, `cnf.thumbprint`, so `isClaimOmitted`).
 *
 * ⚠ SHAPE RULES ARE OPT-IN PER PROFILE, so what they defend they defend only
 * where a profile declares them. `events` and `subjectId` refuse their
 * empty-object form through `eventsShape` / `subIdShape` rather than through the
 * presence rule, and that holds only because every built-in profile requiring
 * either also declares the matching shape rule. A consumer-registered profile
 * that requires one and declares no shape rule has the presence rule alone.
 *
 * pinned: is-claim-satisfied.test.ts, is-claim-omitted.test.ts and
 * `enforce-policy.test.ts` ("`aud: []` addresses nobody") — the demand notion
 * against the empty containers that a single merged predicate let through.
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
