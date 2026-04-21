import { isNumber } from "./is-number.js";

export const isNaN = (input?: any): input is number =>
  isNumber(input) && Number.isNaN(input);
