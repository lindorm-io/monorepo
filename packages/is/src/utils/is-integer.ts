import { isNumber } from "./is-number.js";

// A whole number. Narrower than `isFinite`: `1.5` is finite but not an integer,
// and `NaN`/`Infinity` are neither.
export const isInteger = <T extends number>(input?: any): input is T =>
  isNumber(input) && Number.isInteger(input);
