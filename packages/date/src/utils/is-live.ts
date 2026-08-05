import { type DateArg, isAfter } from "date-fns";

/**
 * Whether `date` is still live at `now`. The boundary is exclusive — a `date`
 * landing on the exact millisecond of `now` is NOT live, since RFC 7519 §4.1.4
 * requires the current time to be strictly before `exp`. Complement of
 * {@link isExpired} for every valid date; an Invalid Date is neither.
 *
 * @remarks ⚠ A bare `number` is read as MILLISECONDS, but a JWT `exp` is a
 * NumericDate in SECONDS (RFC 7519 §2) — `isLive(payload.exp)` is wrong by a
 * factor of 1000. Convert first: `isLive(fromUnixTime(payload.exp))`.
 */
export const isLive = (
  date: DateArg<Date> & {},
  now: DateArg<Date> & {} = new Date(),
): boolean => isAfter(date, now);
