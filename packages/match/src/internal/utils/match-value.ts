import { isArray, isEqual, isObject, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { isConditionOperatorKey } from "../../constants/operators.js";
import { matchOperator } from "./match-operator.js";

/**
 * A `$and` / `$or` payload must be a NON-EMPTY array. An empty logical array is
 * an error rather than an identity element: `undefined` (or an omitted key)
 * already spells "no constraint", and it spells it the same way whichever
 * operator it sits under — where `[]` would mean "everything" under `$and` and
 * "nothing" under `$or`.
 */
const requireMembers = (
  operator: string,
  path: string,
  payload: unknown,
): Array<unknown> => {
  if (!isArray<unknown>(payload)) {
    throw new TypeError(`Operator ${operator} on [ ${path} ] requires an array`);
  }
  if (payload.length === 0) {
    throw new TypeError(
      `Operator ${operator} on [ ${path} ] requires at least one member — omit the key to place no constraint`,
    );
  }
  return payload;
};

const matchValueKey = (
  value: unknown,
  key: string,
  payload: unknown,
  path: string,
): boolean => {
  switch (key) {
    case "$and":
      return requireMembers(key, path, payload).every((member) =>
        matchValue(value, member, path),
      );

    case "$or":
      return requireMembers(key, path, payload).some((member) =>
        matchValue(value, member, path),
      );

    case "$not": {
      // A non-object `$not` is malformed. The undeclared
      // `$not: <primitive>` shorthand it removes was never typed, and it
      // compared by REFERENCE — so a Date, Buffer or array payload was always
      // "not equal" and the condition placed no restriction at all.
      if (!isObject(payload)) {
        throw new TypeError(`Operator $not on [ ${path} ] requires an object payload`);
      }
      return !matchValue(value, payload, path);
    }

    default:
      break;
  }

  if (isConditionOperatorKey(key)) {
    return matchOperator(value, key, payload, path);
  }

  if (key.startsWith("$")) {
    throw new TypeError(`Unknown operator [ ${key} ] on [ ${path} ]`);
  }

  // A plain key is a nested field: a bare composite condition means "contained
  // in", never "equal to". A row whose column is null (or missing the key)
  // simply does not match — it must not crash the whole query.
  if (!isObject<Dict>(value)) return false;

  return matchValue(value[key], payload, path ? `${path}.${key}` : key);
};

/**
 * The ONE dispatch for "does this row VALUE satisfy this condition?". Both call
 * sites use it — a field's condition, and a member of a field-level
 * `$and`/`$or`/`$not` — so a mixed object resolves the same way at every depth.
 * Two sites resolving one object differently WAS the defect: at field level the
 * logical operator used to win, inside a logical member the condition operator
 * did.
 *
 * Every key present must hold. Condition operators, logical operators and
 * nested field keys are all conjoined; `{ $gte: 5, $lt: 10 }` and
 * `{ $not: { $lt: 15 }, $lt: 25 }` are the same rule.
 */
export const matchValue = (value: unknown, condition: unknown, path: string): boolean => {
  // A bare ARRAY means containment — every listed element must be present.
  if (isArray<unknown>(condition)) {
    if (!isArray<unknown>(value)) return false;
    return condition.every((element) =>
      value.some((item) => matchValue(item, element, path)),
    );
  }

  // `isObject` excludes Date and Buffer, so those fall through to `isEqual` and
  // compare by VALUE rather than by reference.
  if (isObject<Dict>(condition)) {
    const keys = Object.keys(condition);

    if (keys.length === 0) {
      throw new TypeError(
        `Condition for [ ${path} ] constrains nothing — omit the key or pass undefined to place no constraint`,
      );
    }

    // `undefined` is stripped BEFORE any shape is validated: it means "not
    // specified", so it must not be able to trip a payload check. A bag whose
    // every value was undefined leaves the field unconstrained.
    const defined = keys.filter((key) => !isUndefined(condition[key]));
    if (defined.length === 0) return true;

    return defined.every((key) => matchValueKey(value, key, condition[key], path));
  }

  return isEqual(value, condition);
};
