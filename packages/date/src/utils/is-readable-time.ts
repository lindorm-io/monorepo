import { isString } from "@lindorm/is";
import { ReadableTime, UNIT_ANY_CASE } from "../types";

// create regex based on UNIT_ANY_CASE
const regex = new RegExp(`^\\d+\\s?(${UNIT_ANY_CASE.join("|")})$`, "i");

export const isReadableTime = (input: any): input is ReadableTime =>
  isString(input) && Boolean(input.match(regex));
