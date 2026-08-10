import { isString } from "@lindorm/is";
import { isValid, parseISO } from "date-fns";

/**
 * Shape gate for an ISO 8601 instant: `YYYY-MM-DDTHH:MM:SS`, optional fractional
 * seconds, and a MANDATORY `Z` or `±HH:MM` offset.
 *
 * The offset is range-checked HERE rather than by the parser — `parseISO` does not
 * validate it at all and happily reads `+99:00`, which `new Date` rejects outright.
 * The date and time fields stay two-digit-only; their ranges belong to the parse.
 */
const REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

/**
 * Type guard for an ISO 8601 date string with an explicit UTC designator or
 * `±HH:MM` offset — `"2026-08-10T12:00:00Z"`, `"2026-08-10T12:00:00.123+02:00"`.
 *
 * Deliberately NARROW: a date-only `"2026-08-10"`, an offset-less
 * `"2026-08-10T12:00:00"`, and a colon-less `"…+0200"` all return `false`, even
 * though `Date` and `parseISO` accept them. Callers convert a match straight to a
 * `Date`, so widening would silently turn arbitrary strings into timestamps.
 *
 * Matching the shape is not enough — the value must also denote a real instant.
 * `"2026-13-45T99:99:99Z"` and `"2026-02-30T00:00:00Z"` are rejected; the latter
 * matters because `new Date` rolls it over to March 2 instead of failing.
 */
export const isDateString = (input: any): input is string =>
  isString(input) && REGEX.test(input) && isValid(parseISO(input));
