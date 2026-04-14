import { isString } from "@lindorm/is";
import { ReadableTime, UNIT_ANY_CASE } from "../types";

// create regex based on UNIT_ANY_CASE
const regex = new RegExp(`^\\d+\\s?(${UNIT_ANY_CASE.join("|")})$`, "i");

/**
 * Type guard for the `ReadableTime` string pattern (e.g. `"10 minutes"`,
 * `"2h"`, `"1 year"`). Case-insensitive, accepts long and short unit forms.
 */
export const isReadableTime = (input: any): input is ReadableTime =>
  isString(input) && Boolean(input.match(regex));
