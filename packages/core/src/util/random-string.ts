import { randomBytes } from "crypto";

const hex = (): string => {
  return randomBytes(2).toString("hex").slice(0, 1);
};

export const getRandomString = (length: number): string => {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64")
    .replace(/\+/g, hex())
    .replace(/\//g, hex())
    .replace(/=/g, hex())
    .slice(0, length);
};
