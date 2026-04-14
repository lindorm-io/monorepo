import { ReadableTime } from "../types";
import { millisecondsToReadable, readableToMilliseconds } from "#internal/utils";

/**
 * Convert between a `ReadableTime` string and a millisecond count. Year and
 * month units are estimated via a Gregorian average (365.2425 days per year,
 * year / 12 per month). For calendar-correct resolution against a reference
 * date, use {@link expires} / {@link expiresAt} / {@link expiresIn}.
 */
export function ms(milliseconds: number): ReadableTime;
export function ms(readable: ReadableTime): number;
export function ms(arg: ReadableTime | number): ReadableTime | number {
  if (typeof arg === "number") return millisecondsToReadable(arg);
  return readableToMilliseconds(arg);
}
