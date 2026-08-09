import { isNull, isUndefined } from "@lindorm/is";

/**
 * "Null or not there at all" — the ROW-VALUE side of the null rule: a row whose
 * column is null, or an object missing the key entirely, does not match a
 * comparison operator.
 *
 * Deliberately NOT a synonym for `isUndefined`: in this language `undefined`
 * means "not specified" on the CONDITION side, while `null` means "explicitly
 * null". The two are interchangeable only when read off a row.
 */
export const isAbsent = (input: unknown): input is null | undefined =>
  isNull(input) || isUndefined(input);
