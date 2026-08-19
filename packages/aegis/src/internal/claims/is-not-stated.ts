import { isNull, isUndefined } from "@lindorm/is";

/**
 * The codec's absence boundary: a position holding one of these was not stated,
 * so it is omitted in both directions rather than refused.
 *
 * ⚠ `null` IS ABSENCE. `AegisProfileAddress` declares every member
 * `string | null` (`types/claims/domain/aegis-profile.ts`), so a caller handing
 * aegis a database row must not have to strip the nulls out of it first.
 *
 * ⛔ `""`, `[]` AND `{}` ARE NOT ABSENCE AND MUST NOT BE ADDED HERE. An empty
 * string is a stated empty string, and whether it rides is the registry's
 * `whenEmpty` column (`internal/registry/param-spec.ts`), on the WRITE side
 * only. Folding it in here would delete that column's only consumer and would
 * rewrite a foreign token's empty member into an absence — aegis reporting that
 * an issuer said nothing where the issuer said "empty".
 *
 * ⛔ `cnf` MEMBERS ARE EXEMPT, and the inconsistency is the security property.
 * `walkConfirmation` asks `=== undefined` on both its declared and its tail arm
 * (`internal/claims/translate.ts`), so a null binding falls through to the
 * member refusal instead of being erased into an unbound token. That file owns
 * the reasoning and the measurement; do not generalise this predicate over it.
 *
 * pinned: is-not-stated.test.ts — the boundary against the other three of the
 * FOUR presence notions tabled in `internal/utils/rules/index.ts`.
 */
export const isNotStated = (value: unknown): value is null | undefined =>
  isUndefined(value) || isNull(value);
