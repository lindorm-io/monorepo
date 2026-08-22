import { isArray, isNull, isObject, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";

/**
 * A logical operator's members. `@lindorm/match` refuses an EMPTY `$and` / `$or`
 * array outright rather than reading it as an identity element, so the shape
 * below never reaches a match and is not analysed here — pinned by "a logical
 * operator with no members is refused by the matcher" in
 * `constrains-nothing.test.ts`.
 */
const isLogicalArray = (payload: unknown): payload is Array<unknown> =>
  isArray<unknown>(payload) && payload.length > 0;

const definedEntries = (condition: NonNullable<unknown>): Array<[string, unknown]> =>
  Object.entries(condition).filter(([, payload]) => !isUndefined(payload));

/**
 * A `$and` / `$or` member, which `matches` recurses into with no shape check of
 * its own — it reads the member with `Object.entries` and nothing else. So a
 * member holding no defined own-enumerable entry (`[]`, `""`, `5`, `new Date()`)
 * matches every record, and reading a member by its ENTRIES rather than by
 * object-ness is what keeps those out of the accepted set.
 *
 * ⚠ A nullish member is the one value `Object.entries` cannot read — it would
 * throw here exactly as it throws inside `matches`, so it counts as constraining
 * rather than crashing the policy check, and it can never become a silent match.
 * Pinned by "a logical operator member that cannot be read is refused by the
 * matcher" in `constrains-nothing.test.ts`.
 */
const isReadableMember = (member: unknown): member is NonNullable<unknown> =>
  !isNull(member) && !isUndefined(member);

const memberConstrainsNothing = (member: unknown): boolean =>
  isReadableMember(member) && constrainsNothing(member);

const memberMatchesNothing = (member: unknown): boolean =>
  isReadableMember(member) && matchesNothing(member);

const entryConstrainsNothing = (key: string, payload: unknown): boolean => {
  switch (key) {
    case "$and":
      return isLogicalArray(payload) && payload.every(memberConstrainsNothing);

    case "$or":
      return isLogicalArray(payload) && payload.some(memberConstrainsNothing);

    case "$not":
      return isObject<Dict>(payload) && matchesNothing(payload);

    // Any other key: a named field, where naming one IS the constraint whatever
    // the operator bag under it says — or any `$`-prefixed key at the root,
    // which the matcher refuses outright instead of answering, whether or not it
    // is an operator it knows. Pinned by "a `$`-prefixed key at the root of a
    // condition is refused by the matcher" in `constrains-nothing.test.ts`.
    default:
      return false;
  }
};

const entryMatchesNothing = (key: string, payload: unknown): boolean => {
  switch (key) {
    case "$and":
      return isLogicalArray(payload) && payload.some(memberMatchesNothing);

    case "$or":
      return isLogicalArray(payload) && payload.every(memberMatchesNothing);

    case "$not":
      return isObject<Dict>(payload) && constrainsNothing(payload);

    default:
      return false;
  }
};

/** Whether NO record can satisfy the condition — the inverse this file needs to read a `$not`. */
const matchesNothing = (condition: NonNullable<unknown>): boolean =>
  definedEntries(condition).some(([key, payload]) => entryMatchesNothing(key, payload));

/**
 * Whether EVERY record satisfies the condition: a filter that has been written
 * but says nothing.
 *
 * The recursion mirrors `matches` in `@lindorm/match` — root keys are conjoined,
 * `$and` needs every member, `$or` any one, `$not` inverts — and it reports only
 * what that structure PROVES. The asymmetry is the hazard: reporting a
 * constraining condition as constraining nothing refuses a filter its author
 * meant, so anything this recursion cannot prove counts as constraining.
 * `{ $not: { subject: "rogue" } }` and `{ subject: { $exists: false } }` are where
 * the two readings come apart — both admit a record carrying no fields at all,
 * and neither constrains nothing. Every row of the boundary is measured against
 * the real matcher in `constrains-nothing.test.ts`.
 */
export const constrainsNothing = (condition: NonNullable<unknown>): boolean =>
  definedEntries(condition).every(([key, payload]) =>
    entryConstrainsNothing(key, payload),
  );
