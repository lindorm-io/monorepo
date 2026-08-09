import { isArray, isEqual, isObject } from "@lindorm/is";

/**
 * JSON containment — what `$has` means, and what every SQL dialect's
 * `compileHas` emits (`@>` / `JSON_CONTAINS`). PLAIN containment: nested
 * OPERATORS are not part of it. A condition no driver can implement is not an
 * oracle, and only the in-memory matcher ever supported operators here.
 *
 * - an ARRAY operand needs every one of its elements contained by the value
 * - a scalar or object operand against an ARRAY value is contained when ANY
 *   element contains it (so `{ tags: { $has: "a" } }` works on an array column)
 * - an OBJECT operand against an object value is a PARTIAL match — every key of
 *   the operand present, and its value contained in turn
 * - anything else compares with the language's single equality, `isEqual`
 */
export const jsonContains = (value: unknown, operand: unknown): boolean => {
  if (isArray(operand)) {
    if (!isArray(value)) return false;
    return operand.every((element) => value.some((item) => jsonContains(item, element)));
  }

  if (isArray(value)) {
    return value.some((item) => jsonContains(item, operand));
  }

  if (isObject(operand)) {
    if (!isObject(value)) return false;
    return Object.keys(operand).every(
      (key) => key in value && jsonContains(value[key], operand[key]),
    );
  }

  return isEqual(value, operand);
};
