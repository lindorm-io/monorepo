import { isNaN } from "./is-nan";

export const isDate = (input: any): input is Date =>
  Boolean(input) && input instanceof Date && !isNaN(input.getTime());
