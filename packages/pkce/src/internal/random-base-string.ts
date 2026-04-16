import { randomBytes } from "crypto";

export const randomBaseString = (length: number): string => {
  if (Buffer.isEncoding("base64url")) {
    return randomBytes(Math.ceil(length * 2))
      .toString("base64url")
      .slice(0, length);
  }

  return randomBytes(Math.ceil(length * 2))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, length);
};
