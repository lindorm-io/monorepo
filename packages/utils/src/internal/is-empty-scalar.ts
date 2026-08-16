import { isNull, isString, isUndefined } from "@lindorm/is";

/**
 * True for the three values that carry NO information: `undefined`, `null`, and
 * `""`. Deliberately narrower than `isEmpty`:
 *
 * - **A container is never an empty scalar.** `[]`, `{}`, an empty `Map`/`Set`
 *   all answer `false`, so a walker driven by this predicate keeps them.
 * - **`0` and `false` are values, not absence.** `isEmpty` already agrees; this
 *   is restated because the two are the most commonly mis-stripped scalars.
 * - Anything else (a `Date`, a buffer, a `RegExp`, a class instance) is opaque
 *   and answers `false`.
 */
export const isEmptyScalar = (value: any): boolean =>
  isNull(value) || isUndefined(value) || (isString(value) && value.length === 0);
