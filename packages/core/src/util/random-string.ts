import { randomBytes } from "crypto";

export const getRandomString = (length: number): string => {
  if (Buffer.isEncoding("base64url")) {
    return randomBytes(Math.ceil(length * 2))
      .toString("base64url")
      .slice(0, length);
  } else {
    return randomBytes(Math.ceil(length * 2))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
      .slice(0, length);
  }
};

export const randomString = getRandomString;
