import type { DateArg } from "date-fns";
import { isBeforeOrEqual } from "./is-before-or-equal.js";

/**
 * Whether `date` has expired at `now`. The boundary is inclusive — a `date`
 * landing on the exact millisecond of `now` is EXPIRED, since RFC 7519 §4.1.4
 * requires the current time to be strictly before `exp`. Complement of
 * {@link isLive} for every valid date; an Invalid Date is neither.
 *
 * @remarks ⚠ A bare `number` is read as MILLISECONDS, but a JWT `exp` is a
 * NumericDate in SECONDS (RFC 7519 §2) — `isExpired(payload.exp)` is wrong by a
 * factor of 1000. Convert first: `isExpired(fromUnixTime(payload.exp))`.
 */
export const isExpired = (
  date: DateArg<Date> & {},
  now: DateArg<Date> & {} = new Date(),
): boolean => isBeforeOrEqual(date, now);
