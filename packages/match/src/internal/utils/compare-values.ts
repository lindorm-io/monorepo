import { isAfter, isBefore } from "@lindorm/date";
import { isBigInt, isDate, isNaN, isNumber, isString } from "@lindorm/is";

/**
 * Three-way ordering for the value types the range operators accept:
 * `number | Date | bigint | string`. Strings use PLAIN JS ordering — no attempt
 * is made to match a database collation, which is a different problem from
 * supporting strings at all.
 *
 * Returns a negative number when `value` sorts before `operand`, zero when they
 * sort equal, positive when after, and `null` when the pair is UNORDERABLE — a
 * boolean, a Buffer, a plain object, a NaN, an Invalid Date (`isDate` rejects a
 * NaN time), or two different kinds. The caller turns `null` into a throw.
 *
 * Numbers and bigints inter-compare because JS orders them natively and the
 * comparison is exact; nothing else crosses kinds.
 */
export const compareValues = (value: unknown, operand: unknown): number | null => {
  if (isDate(value) && isDate(operand)) {
    return isBefore(value, operand) ? -1 : isAfter(value, operand) ? 1 : 0;
  }

  if (isNaN(value) || isNaN(operand)) return null;

  if ((isNumber(value) || isBigInt(value)) && (isNumber(operand) || isBigInt(operand))) {
    return value < operand ? -1 : value > operand ? 1 : 0;
  }

  if (isString(value) && isString(operand)) {
    return value < operand ? -1 : value > operand ? 1 : 0;
  }

  return null;
};
