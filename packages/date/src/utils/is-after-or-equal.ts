import { type DateArg, isAfter, isEqual } from "date-fns";

/**
 * Whether `date` is at or after `dateToCompare` — the `>=` that date-fns omits.
 * date-fns ships only `isAfter` (`>`), `isBefore` (`<`) and `isEqual` (`===`),
 * so an inclusive comparison would otherwise have to be written as
 * `!isBefore(...)`, and lindorm forbids negating a comparison predicate. Mirror
 * of {@link isBeforeOrEqual}.
 *
 * Comparison is numeric, so an Invalid Date returns `false`.
 */
export const isAfterOrEqual = (
  date: DateArg<Date> & {},
  dateToCompare: DateArg<Date> & {},
): boolean => isAfter(date, dateToCompare) || isEqual(date, dateToCompare);
