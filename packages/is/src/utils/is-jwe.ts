import { parseTokenHeader } from "../internal/index";

const LENGTH = 5;
const REGEX =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const isJwe = (input: any): boolean => {
  if (typeof input !== "string") return false;
  if (!REGEX.test(input)) return false;

  const header = parseTokenHeader(input);
  if (!header) return false;

  const split = input.split(".");
  if (split.length !== LENGTH) return false;

  try {
    return header && typeof header.alg === "string" && header.typ === "JWE";
  } catch {
    return false;
  }
};
