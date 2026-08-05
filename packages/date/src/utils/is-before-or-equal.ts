import { type DateArg, isBefore, isEqual } from "date-fns";

/**
 * Whether `date` is at or before `dateToCompare` — the `<=` that date-fns omits.
 * date-fns ships only `isAfter` (`>`), `isBefore` (`<`) and `isEqual` (`===`),
 * so an inclusive comparison would otherwise have to be written as
 * `!isAfter(...)`, and lindorm forbids negating a comparison predicate. Mirror
 * of {@link isAfterOrEqual}.
 *
 * Comparison is numeric, so an Invalid Date returns `false`.
 */
export const isBeforeOrEqual = (
  date: DateArg<Date> & {},
  dateToCompare: DateArg<Date> & {},
): boolean => isBefore(date, dateToCompare) || isEqual(date, dateToCompare);
