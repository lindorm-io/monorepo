import type { Condition, ConditionOperator } from "@lindorm/match";
import { isArray, isObject, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";

/**
 * Compiles ONE claim entry of a condition object: the caller's key and value in,
 * the output key and its operator out. Everything a builder decides per claim —
 * the wire name, the value lift, which keys it refuses — lives here.
 */
export type LeafHandler = (
  key: string,
  value: unknown,
) => [outKey: string, operator: ConditionOperator<any>];

/**
 * The ONE recursion both matcher builders share. A condition is a tree: the root
 * operators `$and` / `$or` carry an array of conditions and `$not` carries one,
 * and every other key is a claim the leaf handler compiles. The tree shape is
 * `@lindorm/match`'s, so a payload the matcher would refuse (a `$and` / `$or`
 * that is not an array, a `$not` that is not an object, a member that is not an
 * object) is passed through untouched and refused there.
 *
 * `createLeaf` is called once per condition OBJECT, so state a handler keeps
 * (`createIdentityMatchers`' wire-name collision guard) is scoped to the object
 * whose keys it compiles and never reaches a sibling branch.
 *
 * An `undefined` value is skipped at every level — the matcher's own rule: it
 * means "not specified", never "match undefined".
 */
export const buildCondition = (
  condition: Dict,
  createLeaf: () => LeafHandler,
): Condition<Dict> => {
  const leaf = createLeaf();

  // ⛔ `Object.fromEntries`, NEVER `predicate[key] = operator`. The key is the
  // CALLER's, and a leaf handler answers an operator for `__proto__` like any
  // other string. Assigned onto a plain object it hits `Object.prototype`'s
  // setter and swaps the prototype instead of defining the key, so the assertion
  // is dropped and the token verifies unasserted. Pinned at
  // `jwt-validate.test.ts#a __proto__ assertion is CARRIED` and
  // `build-condition.test.ts#should carry a __proto__ key`.
  return Object.fromEntries(
    Object.entries(condition)
      .filter(([, value]) => !isUndefined(value))
      .map(([key, value]): [string, unknown] => {
        // A closed internal list matched by `===`, never `in` on the caller's
        // object: a caller key is looked up nowhere here.
        switch (key) {
          case "$and":
          case "$or":
            return [
              key,
              isArray<unknown>(value)
                ? value.map((member) =>
                    isObject(member) ? buildCondition(member, createLeaf) : member,
                  )
                : value,
            ];

          case "$not":
            return [key, isObject(value) ? buildCondition(value, createLeaf) : value];

          default:
            return leaf(key, value);
        }
      }),
  ) as Condition<Dict>;
};
