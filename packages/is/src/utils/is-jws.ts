import { parseTokenHeader } from "./private";

const LENGTH = 3;
const REGEX = /^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/;

export const isJws = (input: any): boolean => {
  if (typeof input !== "string") return false;
  if (!REGEX.test(input)) return false;

  const header = parseTokenHeader(input);
  if (!header) return false;

  const split = input.split(".");
  if (split.length !== LENGTH) return false;

  try {
    return header && typeof header.alg === "string" && header.typ === "JWS";
  } catch {
    return false;
  }
};
