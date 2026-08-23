import { isArray, isObject, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { isConditionOperatorKey } from "../constants/operators.js";
import { matchValue } from "../internal/utils/match-value.js";
import type { Condition } from "../types/condition.js";

const requireConditions = (operator: string, payload: unknown): Array<unknown> => {
  if (!isArray<unknown>(payload)) {
    throw new TypeError(`Operator ${operator} requires an array`);
  }
  if (payload.length === 0) {
    throw new TypeError(
      `Operator ${operator} requires at least one member — omit the key to place no constraint`,
    );
  }
  return payload;
};

const matchRootKey = <T extends Dict>(
  object: T,
  key: string,
  payload: unknown,
): boolean => {
  switch (key) {
    case "$and":
      return requireConditions(key, payload).every((member) =>
        matches(object, member as Condition<T>),
      );

    case "$or":
      return requireConditions(key, payload).some((member) =>
        matches(object, member as Condition<T>),
      );

    case "$not": {
      if (!isObject(payload)) {
        throw new TypeError("Operator $not requires an object payload");
      }
      return !matches(object, payload as Condition<T>);
    }

    default:
      break;
  }

  // The root of a condition names FIELDS, so nothing spelled as an operator has
  // a field to apply to. ⚠ The `$` test is what makes the refusal complete: an
  // UNREGISTERED `$` key clears `isConditionOperatorKey` and would otherwise be
  // read as a field name and quietly match nothing.
  // pinned: matches.test.ts, "M-7 — a condition operator at the ROOT throws".
  if (isConditionOperatorKey(key) || key.startsWith("$")) {
    throw new TypeError(`Operator ${key} cannot be used at the root of a condition`);
  }

  return matchValue(object?.[key as keyof T], payload, key);
};

/**
 * Test one record against a condition.
 *
 * The ROOT of a condition is the one place `{}` is legitimate — it names no
 * field, so it constrains nothing and every record matches. A NAMED field with
 * an empty operator bag is the opposite: naming it says you are constraining
 * it, and constraining it with nothing contradicts that, so it throws.
 *
 * `undefined` is stripped first, everywhere and without exception: it means
 * "not specified", never "match null". `null` is a real value and is respected.
 */
export const matches = <T extends Dict>(object: T, condition: Condition<T>): boolean =>
  Object.entries(condition)
    .filter(([, payload]) => !isUndefined(payload))
    .every(([key, payload]) => matchRootKey(object, key, payload));
