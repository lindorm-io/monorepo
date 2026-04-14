import { ReadableTime } from "../types";
import { millisecondsToReadable, readableToMilliseconds } from "#internal/utils";

/**
 * Convert between a `ReadableTime` string and a second count. Year and
 * month units are estimated via a Gregorian average (365.2425 days per year).
 * For calendar-correct resolution against a reference date, use
 * {@link expires} / {@link expiresIn}.
 */
export function sec(seconds: number): ReadableTime;
export function sec(readable: ReadableTime): number;
export function sec(arg: ReadableTime | number): ReadableTime | number {
  if (typeof arg === "number") return millisecondsToReadable(arg * 1000);
  return Math.floor(readableToMilliseconds(arg) / 1000);
}
