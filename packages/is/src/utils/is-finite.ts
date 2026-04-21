import { isNumber } from "./is-number.js";

export const isFinite = <T extends number>(input?: any): input is T =>
  isNumber(input) && Number.isFinite(input);
