import { isString } from "./is-string";

const LENGTH = 5;
const REGEX =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const isJwe = (input: any): input is string =>
  isString(input) && input.split(".").length === LENGTH && REGEX.test(input);
