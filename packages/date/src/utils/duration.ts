import type { DurationDict, ReadableTime } from "../types/index.js";
import { millisecondsToDuration, readableToDuration } from "../internal/utils/index.js";

/**
 * Convert between a `ReadableTime` string and a `DurationDict`. String input
 * is parsed exactly. Numeric input is bucketised using a Gregorian-year
 * estimation (365.2425 days) — use {@link expires} if you need calendar-
 * correct year/month resolution against a reference date.
 */
export function duration(milliseconds: number): DurationDict;
export function duration(readable: ReadableTime): DurationDict;
export function duration(arg: ReadableTime | number): DurationDict {
  if (typeof arg === "number") return millisecondsToDuration(arg);
  return readableToDuration(arg);
}
