import {
  isArray,
  isBoolean,
  isDate,
  isEqual,
  isNull,
  isNumber,
  isObject,
  isRegExp,
  isString,
} from "@lindorm/is";
import type { ConditionOperatorKey } from "../constants/operators.js";
import { compareValues } from "./compare-values.js";
import { isAbsent } from "./is-absent.js";
import { jsonContains } from "./json-contains.js";
import { likeToRegex } from "./like-to-regex.js";

const describeValue = (input: unknown): string =>
  isNull(input)
    ? "null"
    : isArray(input)
      ? "array"
      : isDate(input)
        ? "date"
        : typeof input;

/**
 * Shape is validated, everywhere: PRESENCE decides that an operator applies,
 * and a payload of the wrong shape is a malformed condition rather than a
 * silently dropped clause. Silent drops are what let a truthiness test on
 * `$not` compile to no WHERE clause at all.
 */
const malformed = (
  operator: string,
  path: string,
  expected: string,
  operand: unknown,
): never => {
  throw new TypeError(
    `Operator ${operator} on [ ${path} ] requires ${expected}, received [ ${describeValue(operand)} ]`,
  );
};

const unsupported = (operator: string, path: string, value: unknown): never => {
  throw new TypeError(
    `Operator ${operator} is not supported for value type [ ${describeValue(value)} ] on [ ${path} ]`,
  );
};

const requireList = (operator: string, path: string, operand: unknown): Array<unknown> =>
  isArray<unknown>(operand) ? operand : malformed(operator, path, "an array", operand);

const includesEqual = (list: Array<unknown>, value: unknown): boolean =>
  list.some((item) => isEqual(item, value));

/**
 * The membership test `$in` performs, and the one `$nin` negates. A value that
 * is itself an ARRAY matches when any of its elements is in the list.
 *
 * Comparison is `isEqual` — the language has ONE definition of equality, the one
 * `$eq` uses. `Array.includes` compared Dates, Buffers and objects by identity,
 * so `{ createdAt: { $in: [sameInstant] } }` matched nothing while every SQL
 * driver matched by value.
 */
const isMember = (value: unknown, list: Array<unknown>): boolean =>
  isArray<unknown>(value)
    ? value.some((item) => includesEqual(list, item))
    : includesEqual(list, value);

/**
 * Ordering comparison with the null rule applied to BOTH sides, which are
 * different concerns: a null/absent ROW VALUE simply does not match (the row is
 * filtered out, exactly as every database does it), while a null OPERAND is an
 * unorderable payload and therefore malformed.
 */
const compareOperand = (
  operator: string,
  path: string,
  value: unknown,
  operand: unknown,
  test: (comparison: number) => boolean,
): boolean => {
  if (isAbsent(operand)) {
    return malformed(operator, path, "an orderable operand", operand);
  }
  if (isAbsent(value)) return false;

  const comparison = compareValues(value, operand);
  if (isNull(comparison)) return unsupported(operator, path, value);

  return test(comparison);
};

/**
 * Evaluate ONE operator against one row value. Every operator in an operator
 * object is evaluated independently and the results are AND-ed by the caller —
 * an operator object is a conjunction, including when a logical operator sits
 * among its keys.
 */
export const matchOperator = (
  value: unknown,
  operator: ConditionOperatorKey,
  operand: unknown,
  path: string,
): boolean => {
  switch (operator) {
    case "$exists": {
      if (!isBoolean(operand)) return malformed(operator, path, "a boolean", operand);
      // `$exists` means NOT NULL — the only reading a relational column can
      // implement, since a column always "exists".
      return operand ? !isAbsent(value) : isAbsent(value);
    }

    case "$eq":
      return isEqual(value, operand);

    case "$neq":
      return !isEqual(value, operand);

    case "$gt":
      return compareOperand(operator, path, value, operand, (c) => c > 0);

    case "$gte":
      return compareOperand(operator, path, value, operand, (c) => c >= 0);

    case "$lt":
      return compareOperand(operator, path, value, operand, (c) => c < 0);

    case "$lte":
      return compareOperand(operator, path, value, operand, (c) => c <= 0);

    case "$between": {
      if (!isArray<unknown>(operand) || operand.length !== 2) {
        return malformed(operator, path, "a two-element tuple", operand);
      }
      const [low, high] = operand;
      // Both bounds are shape-checked BEFORE any row is looked at, so a
      // malformed payload throws for every row rather than only for the rows
      // that happen to reach the second comparison.
      if (isAbsent(low) || isAbsent(high)) {
        return malformed(operator, path, "two orderable bounds", operand);
      }
      if (isAbsent(value)) return false;

      const lower = compareValues(value, low);
      const upper = compareValues(value, high);
      if (isNull(lower) || isNull(upper)) return unsupported(operator, path, value);

      // Inclusive at both ends.
      return lower >= 0 && upper <= 0;
    }

    case "$like":
    case "$ilike": {
      if (!isString(operand)) return malformed(operator, path, "a string", operand);
      if (!isString(value)) return false;
      return likeToRegex(operand, operator === "$ilike").test(value);
    }

    case "$regex": {
      if (!isRegExp(operand)) return malformed(operator, path, "a RegExp", operand);
      if (!isString(value)) return false;
      return new RegExp(operand).test(value);
    }

    case "$similar":
      // PostgreSQL pg_trgm trigram search — it compiles to a driver-specific
      // query and has no in-memory equivalent, so surface it as a clear error
      // (mirroring the non-Postgres SQL dialects) rather than never matching.
      throw new TypeError(
        `Operator $similar (PostgreSQL trigram search) cannot be evaluated for in-memory matching on [ ${path} ]`,
      );

    case "$in":
      return isMember(value, requireList(operator, path, operand));

    case "$nin":
      return !isMember(value, requireList(operator, path, operand));

    case "$all": {
      const list = requireList(operator, path, operand);
      return isArray<unknown>(value) && list.every((item) => includesEqual(value, item));
    }

    case "$overlap": {
      const list = requireList(operator, path, operand);
      return isArray<unknown>(value) && list.some((item) => includesEqual(value, item));
    }

    case "$contained": {
      const list = requireList(operator, path, operand);
      return isArray<unknown>(value) && value.every((item) => includesEqual(list, item));
    }

    case "$length": {
      if (!isNumber(operand)) return malformed(operator, path, "a number", operand);
      if (isAbsent(value)) return false;
      if (isArray(value) || isString(value)) return value.length === operand;
      if (isObject(value)) return Object.keys(value).length === operand;
      return unsupported(operator, path, value);
    }

    case "$has":
      return jsonContains(value, operand);

    case "$mod": {
      if (!isArray<unknown>(operand) || operand.length !== 2) {
        return malformed(operator, path, "a two-element tuple", operand);
      }
      const [divisor, remainder] = operand;
      if (!isNumber(divisor) || !isNumber(remainder)) {
        return malformed(
          operator,
          path,
          "a divisor and remainder that are numbers",
          operand,
        );
      }
      if (divisor === 0) {
        throw new Error(
          `Division by zero is not allowed in $mod operator on [ ${path} ]`,
        );
      }
      if (isAbsent(value)) return false;
      if (!isNumber(value)) return unsupported(operator, path, value);
      return value % divisor === remainder;
    }

    default: {
      const exhaustive: never = operator;
      throw new TypeError(`Unknown operator [ ${String(exhaustive)} ] on [ ${path} ]`);
    }
  }
};
