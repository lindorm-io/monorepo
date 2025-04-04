import { isNumber } from "./is-number";

export const isNaN = (input?: any): input is number =>
  isNumber(input) && Number.isNaN(input);
