/**
 * The claim-rule layer — the pure predicates a profile policy is assembled from.
 *
 * --- FOUR presence notions, and none of them is another ---
 *
 *   demand  "is there something to bite on?"  isClaimSatisfied  aegis
 *           — and, at mint, not in the writer's `unreadable` set (`translate.ts`)
 *   vocab   "did the author name this key?"   isClaimOmitted    aegis
 *   stated  "was a value stated at all?"      isNotStated       aegis
 *   null    "is the value non-null?"          $exists           @lindorm/match
 *
 * `required` / `atLeastOneOf` / `requiredWhen` read the demand notion,
 * `forbidden` and every shape rule's entry guard read the vocabulary one, and a
 * `match` condition written with `$exists` reads the null one.
 *
 * ⛔ `isNotStated` is the CODEC's question (`internal/claims/is-not-stated.ts`)
 * and is NOT exported from this barrel: the translator has already emptied the bag
 * of unstated positions, so a rule asking it gets one answer. Its ONE exception is
 * a `cnf` MEMBER, which takes the VOCABULARY notion instead (`translate.ts`,
 * `internal/cose/cose-key.ts`) — a security property; do not unify it away.
 *
 * ⚠ `$exists` means NOT NULL (`@lindorm/match`, `constants/operators.ts`), not
 * "the key is present". `ISSUER_IS_URI` and `AUD_SINGLE_RESOURCE` are written
 * against that meaning. Not ours to change — ours to name.
 *
 * ⚠ `isClaimOmitted` is `=== undefined`, NOT `Object.hasOwn`, and does not
 * contravene `enforce-policy.ts`'s hasOwn-never-`in` doctrine: that governs a
 * MEMBERSHIP test on a caller-supplied KEY, this is a VALUE test. The two states
 * `Object.hasOwn` would separate cannot differ, and what establishes that is
 * `assemble-common-claims.ts` on mint and `internal/claims/translate.ts` on
 * verify — ⛔ NOT `normalise-claims.ts`, whose absence strip runs at
 * serialisation, after `mint-token.ts` has already enforced the policy.
 *
 * ⚠ EVERY DEPTH, not just the top level: a format's REQUIRED member is a demand
 * (`subjectId.id` of `""` identifies nobody), a validate-it-when-present member is
 * vocabulary (`act.subject`, `cnf.thumbprint`).
 *
 * ⚠ SHAPE RULES ARE OPT-IN PER PROFILE. `events` and `subjectId` refuse their
 * empty-object form through `eventsShape` / `subIdShape`, not through the presence
 * rule, so a consumer-registered profile that requires one and declares no shape
 * rule has the presence rule alone.
 *
 * pinned: is-claim-satisfied.test.ts, is-claim-omitted.test.ts,
 * enforce-policy.test.ts.
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
