import { parseTokenHeader } from "./private";

const JWE_LENGTH = 5;
const JWE_REGEX =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const JWT_LENGTH = 3;
const JWT_REGEX = /^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/;

export const isWebToken = (input: any): input is string => {
  if (typeof input !== "string") return false;

  if (!JWE_REGEX.test(input) && !JWT_REGEX.test(input)) return false;

  const header = parseTokenHeader(input);
  if (!header) return false;

  const split = input.split(".");
  if (split.length !== JWE_LENGTH && split.length !== JWT_LENGTH) return false;

  try {
    return header && typeof header.alg === "string" && typeof header.typ === "string";
  } catch {
    return false;
  }
};
