import { isNumber } from "./is-number";

export const isFinite = (input?: any): input is number =>
  isNumber(input) && Number.isFinite(input);
