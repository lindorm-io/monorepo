import { isString } from "./is-string";

const LENGTH = 3;
const REGEX = /^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/;

export const isJwt = (input: any): input is string =>
  isString(input) && input.split(".").length === LENGTH && REGEX.test(input);
