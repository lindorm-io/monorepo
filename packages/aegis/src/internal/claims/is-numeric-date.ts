import { isDate, isNumber } from "@lindorm/is";

/**
 * A NumericDate: a number of seconds since the epoch, integral or not
 * (RFC 7519 §2, RFC 8392 §2), naming an instant a `Date` can hold.
 *
 * ⚠ The number test comes first: the multiplication coerces a numeric string
 * and throws a raw `TypeError` on a bigint.
 */
export const isNumericDate = (value: unknown): value is number =>
  isNumber(value) && isDate(new Date(value * 1000));
